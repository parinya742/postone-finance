<?php

namespace App\Services\HpmhRtv;

use App\Services\PdfExtractor;
use Carbon\Carbon;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Reads HP-MH RTV return slip PDFs (scripts/pdf/extract_hpmh_return_slip.py) into
 * hpmh_rtv.return_slip_extract (+ _item).
 *
 * A document is "pending" when it has no extract yet, its PDF was replaced (s3_key changed), or it was read by an
 * older extractor (VERSION). Pending documents are picked up by `hpmh-rtv:extract-pending` (scheduled), by the
 * "ประมวลผล" button on the return slip page, and on demand when someone opens a slip's data.
 */
class ReturnSlipExtractService
{
    /** Bump when the parser or the OCR repair changes its output, so stored rows get re-read. */
    // v3: vendor block, branch tel, buyer code/name, base qty, return reason, reversed slip; national IDs masked
    // v4: IDs written in groups ("5 4114 00020 10 4") masked too; a 1st remark that is a note isn't a reason
    public const VERSION = 'return-slip-v4';

    private const SCRIPT = 'extract_hpmh_return_slip.py';

    public function __construct(private PdfExtractor $extractor) {}

    private function db(): Connection
    {
        return DB::connection('hpmh_rtv');
    }

    /** Documents with a PDF whose extract is missing or out of date; error rows only with $withErrors. */
    public function pendingQuery(?string $vendorNo = null, bool $withErrors = false): Builder
    {
        return $this->db()->table('return_slip_document as d')
            ->leftJoin('return_slip_extract as e', 'e.document_id', '=', 'd.id')
            ->whereNotNull('d.s3_key')
            ->when($vendorNo, fn ($q) => $q->where('d.vendor_no', $vendorNo))
            ->where(function ($q) use ($withErrors) {
                $q->whereNull('e.id')
                    ->orWhereRaw('e.source_s3_key IS DISTINCT FROM d.s3_key')
                    ->orWhere('e.extractor_version', '<>', self::VERSION)
                    ->when($withErrors, fn ($q) => $q->orWhere('e.status', 'error'));
            });
    }

    public function status(?string $vendorNo = null): array
    {
        $row = $this->db()->table('return_slip_document as d')
            ->leftJoin('return_slip_extract as e', 'e.document_id', '=', 'd.id')
            ->whereNotNull('d.s3_key')
            ->when($vendorNo, fn ($q) => $q->where('d.vendor_no', $vendorNo))
            ->selectRaw('COUNT(*) as documents')
            ->selectRaw("COUNT(*) FILTER (WHERE e.id IS NOT NULL AND e.source_s3_key IS NOT DISTINCT FROM d.s3_key AND e.extractor_version = ?) as current", [self::VERSION])
            ->selectRaw("COUNT(*) FILTER (WHERE e.status = 'ok') as ok")
            ->selectRaw("COUNT(*) FILTER (WHERE e.status = 'warning') as warning")
            ->selectRaw("COUNT(*) FILTER (WHERE e.status = 'error') as error")
            ->first();

        return [
            'documents' => (int) $row->documents,
            'extracted' => (int) $row->current,
            'pending' => $this->pendingQuery($vendorNo)->count(),
            'ok' => (int) $row->ok,
            'warning' => (int) $row->warning,
            'error' => (int) $row->error,
            'version' => self::VERSION,
        ];
    }

    /**
     * Extract up to $limit pending documents in one Python run.
     *
     * @return array{processed: int, ok: int, warning: int, error: int, remaining: int}
     */
    public function processPending(int $limit, ?string $vendorNo = null, bool $withErrors = false): array
    {
        $docs = $this->pendingQuery($vendorNo, $withErrors)
            ->select('d.id', 'd.vendor_no', 'd.article_doc_no', 'd.fiscal_year', 'd.s3_bucket', 'd.s3_key')
            ->orderByRaw('e.id IS NOT NULL')   // never-read documents first
            ->orderByDesc('d.id')
            ->limit($limit)
            ->get();

        $counts = ['processed' => 0, 'ok' => 0, 'warning' => 0, 'error' => 0];
        foreach ($this->extractDocuments($docs) as $status) {
            $counts['processed']++;
            $counts[$status]++;
        }

        return $counts + ['remaining' => $this->pendingQuery($vendorNo, $withErrors)->count()];
    }

    /** @return array<int, string> status per document id */
    public function extractDocuments(iterable $docs): array
    {
        $docs = collect($docs)->keyBy('id');
        if ($docs->isEmpty()) {
            return [];
        }
        $statuses = [];
        foreach ($this->extractor->runMany($docs->values(), self::SCRIPT) as $id => $result) {
            $statuses[$id] = $this->save($docs[$id], $result);
        }

        return $statuses;
    }

    /**
     * The stored extract of one document in the API shape, extracting it first when it is missing, out of date,
     * or $refresh is set. Null when the document doesn't exist.
     */
    public function forDocument(int $documentId, bool $refresh = false): ?array
    {
        $doc = $this->db()->table('return_slip_document')
            ->select('id', 'vendor_no', 'article_doc_no', 'fiscal_year', 'pdf_file_name', 's3_bucket', 's3_key')
            ->find($documentId);
        if (! $doc) {
            return null;
        }

        $row = $this->db()->table('return_slip_extract')->where('document_id', $documentId)->first();
        $stale = ! $row || $row->source_s3_key !== $doc->s3_key || $row->extractor_version !== self::VERSION;
        if ($refresh || $stale) {
            $this->extractDocuments([$doc]);
            $row = $this->db()->table('return_slip_extract')->where('document_id', $documentId)->first();
        }

        return $row ? $this->toResponse($row, $doc) : null;
    }

    /** Store one extractor result (replacing the document's previous extract). Returns the status. */
    private function save(object $doc, array $result): string
    {
        $ok = ! isset($result['error']);
        $warnings = $ok ? ($result['warnings'] ?? []) : [];
        $status = ! $ok ? 'error' : ($warnings ? 'warning' : 'ok');
        $now = now();

        $header = [
            'document_id' => $doc->id,
            'vendor_no' => $result['vendor_no'] ?? $doc->vendor_no,
            'article_doc_no' => $result['article_doc_no'] ?? $doc->article_doc_no,
            'fiscal_year' => $result['fiscal_year'] ?? $doc->fiscal_year,
            'site_code' => $result['site_code'] ?? null,
            'site' => $result['site'] ?? null,
            'storage_location' => $result['storage_location'] ?? null,
            'doc_date' => $this->date($result['doc_date'] ?? null),
            'doc_time' => $result['doc_time'] ?? null,
            'delivery_note' => $result['delivery_note'] ?? null,
            'buyer' => $result['buyer'] ?? null,
            'buyer_code' => $result['buyer_code'] ?? null,
            'buyer_name' => $result['buyer_name'] ?? null,
            'created_by' => $result['created_by'] ?? null,
            'site_tel' => $result['site_tel'] ?? null,
            'site_tel2' => $result['site_tel2'] ?? null,
            'vendor_name' => $result['vendor_name'] ?? null,
            'vendor_address' => $result['vendor_address'] ?? null,
            'vendor_contact' => $result['vendor_contact'] ?? null,
            'vendor_tel' => $result['vendor_tel'] ?? null,
            'po_text' => $result['po_text'] ?? null,
            'gr_text' => $result['gr_text'] ?? null,
            'pages' => $result['pages'] ?? null,
            'items_count' => $result['items_count'] ?? 0,
            'qty_sum' => $result['qty_sum'] ?? null,
            'items_sum' => $result['items_sum'] ?? null,
            'total_qty' => $result['total_qty'] ?? null,
            'total_bu' => $result['total_bu'] ?? null,
            'total' => $result['total'] ?? null,
            'status' => $status,
            'warnings' => $this->json($warnings),
            'error' => $ok ? null : mb_substr((string) $result['error'], 0, 2000),
            'source_s3_key' => $doc->s3_key,
            'extractor_version' => self::VERSION,
            'ocr_used' => (bool) ($result['ocr']['used'] ?? false),
            'ocr_lines' => (int) ($result['ocr']['lines'] ?? 0),
            'ocr_error' => $result['ocr']['error'] ?? null,
            'raw' => $ok ? $this->json($result) : null,
            'extracted_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->db()->transaction(function () use ($header, $result, $ok, $now) {
            // The upsert row-locks the header, so concurrent runs on one document (scheduler + button) serialise
            $this->db()->table('return_slip_extract')->upsert(
                [$header], ['document_id'], array_values(array_diff(array_keys($header), ['document_id', 'created_at']))
            );
            $extractId = $this->db()->table('return_slip_extract')->where('document_id', $header['document_id'])->value('id');

            $this->db()->table('return_slip_extract_item')->where('extract_id', $extractId)->delete();
            if (! $ok) {
                return;
            }
            $rows = array_map(function (array $i) use ($extractId, $now) {
                [$poNo, $poItem] = array_pad(explode('/', (string) ($i['po'] ?? ''), 2), 2, null);

                return [
                    'extract_id' => $extractId,
                    'item_no' => $i['item'],
                    'vd_part' => $i['vd_part'] ?? null,
                    'article' => $i['article'] ?? null,
                    'batch' => $i['batch'] ?? null,
                    'po_no' => $poNo ?: null,
                    'po_item' => $poItem,
                    'mvt' => $i['mvt'] ?? null,
                    's' => $i['s'] ?? null,
                    'reference' => $i['reference'] ?? null,
                    'unit' => $i['unit'] ?? null,
                    'qty' => $i['qty'] ?? null,
                    'base_qty' => $i['base_qty'] ?? null,
                    'base_unit' => $i['base_unit'] ?? null,
                    'price' => $i['price'] ?? null,
                    'amount' => $i['amount'] ?? null,
                    'description' => $i['description'] ?? null,
                    'description_pdf' => $i['description_pdf'] ?? null,
                    'return_reason' => $i['return_reason'] ?? null,
                    'reversed_doc_no' => $i['reversed_doc_no'] ?? null,
                    'remarks' => $this->json($i['remarks'] ?? []),
                    'remarks_pdf' => $this->json($i['remarks_pdf'] ?? []),
                    'page' => $i['page'] ?? null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }, $result['items'] ?? []);
            foreach (array_chunk($rows, 200) as $chunk) {
                $this->db()->table('return_slip_extract_item')->insert($chunk);
            }
        });

        return $status;
    }

    /** API shape used by the return slip page (frontend HpmhRtvReturnSlipExtract). */
    private function toResponse(object $row, object $doc): array
    {
        $num = fn ($v) => $v === null ? null : (float) $v;
        $raw = $row->raw ? json_decode($row->raw, true) : [];

        $items = $this->db()->table('return_slip_extract_item')->where('extract_id', $row->id)->orderBy('item_no')->get()
            ->map(fn ($i) => [
                'item' => (int) $i->item_no,
                'vd_part' => $i->vd_part,
                'article' => $i->article,
                'batch' => $i->batch,
                'po' => $i->po_item !== null ? "{$i->po_no}/{$i->po_item}" : $i->po_no,
                'mvt' => $i->mvt,
                's' => $i->s,
                'reference' => $i->reference,
                'unit' => $i->unit,
                'qty' => $num($i->qty),
                'base_qty' => $num($i->base_qty),
                'base_unit' => $i->base_unit,
                'price' => $num($i->price),
                'amount' => $num($i->amount),
                'description' => $i->description,
                'description_pdf' => $i->description_pdf,
                'return_reason' => $i->return_reason,
                'reversed_doc_no' => $i->reversed_doc_no,
                'remarks' => json_decode($i->remarks ?? '[]', true),
                'page' => $i->page,
            ]);

        return [
            'document_id' => (int) $doc->id,
            'file_name' => $doc->pdf_file_name,
            'status' => $row->status,
            'error' => $row->error,
            'article_doc_no' => $row->article_doc_no,
            'fiscal_year' => $row->fiscal_year,
            'site_code' => $row->site_code,
            'site' => $row->site,
            'storage_location' => $row->storage_location,
            'vendor_no' => $row->vendor_no,
            'doc_date' => $row->doc_date,
            'doc_time' => $row->doc_time,
            'delivery_note' => $row->delivery_note,
            'buyer' => $row->buyer,
            'buyer_code' => $row->buyer_code,
            'buyer_name' => $row->buyer_name,
            'created_by' => $row->created_by,
            'site_tel' => $row->site_tel,
            'site_tel2' => $row->site_tel2,
            'vendor_name' => $row->vendor_name,
            'vendor_address' => $row->vendor_address,
            'vendor_contact' => $row->vendor_contact,
            'vendor_tel' => $row->vendor_tel,
            'po_text' => $row->po_text,
            'gr_text' => $row->gr_text,
            'pages' => (int) $row->pages,
            'items' => $items,
            'items_count' => (int) $row->items_count,
            'qty_sum' => $num($row->qty_sum),
            'items_sum' => $num($row->items_sum),
            'total_qty' => $num($row->total_qty),
            'total_bu' => $num($row->total_bu),
            'total' => $num($row->total),
            'warnings' => json_decode($row->warnings ?? '[]', true),
            'ocr' => ['used' => (bool) $row->ocr_used, 'lines' => (int) $row->ocr_lines, 'ms' => (int) ($raw['ocr']['ms'] ?? 0), 'error' => $row->ocr_error],
            'extractor_version' => $row->extractor_version,
            'extracted_at' => Carbon::parse($row->extracted_at)->toIso8601String(),
        ];
    }

    private function date(?string $dmy): ?string
    {
        if (! $dmy) {
            return null;
        }
        try {
            return Carbon::createFromFormat('!d/m/Y', $dmy)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function json(mixed $v): string
    {
        return json_encode($v, JSON_UNESCAPED_UNICODE);
    }
}
