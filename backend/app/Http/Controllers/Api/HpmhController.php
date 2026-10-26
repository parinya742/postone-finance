<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MT — HP-MH (HomePro / MegaHome) correspondence data (connection "hpmh", schema hpmh),
 * populated by the n8n HPMH scraper.
 *
 * correspondence 1—0..1 correspondence_attachment, and a parsed attachment yields either
 * correspondence_coupon or correspondence_leaflet rows; all are linked by (vendor_no, content_item_id).
 */
class HpmhController extends Controller
{
    use QueriesReportTables;

    private const FILE_TABLES = [
        'correspondence' => 'correspondence_file',
        'attachment'     => 'correspondence_attachment',
        'pas'            => 'pas_file',
        'receipt'        => 'receipt_document',
        'receipt-excel'  => 'receipt_file',
        'compensate'          => 'compensate_file',
        'compensate-document' => 'compensate_document',
    ];

    private function db()
    {
        return DB::connection('hpmh');
    }

    private function joinCorrespondenceSubject(Builder $q, string $alias): void
    {
        $q->leftJoin('correspondence as c', function ($j) use ($alias) {
            $j->on('c.vendor_no', '=', "{$alias}.vendor_no")
              ->on('c.content_item_id', '=', "{$alias}.content_item_id");
        });
    }

    // ── Correspondence ──────────────────────────────────────────────────────

    public function correspondenceFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('correspondence_file')
            ->select('id', 'run_id', 'vendor_no', 'file_name', 'file_size', 'row_count', 'downloaded_at');

        $this->applySearch($q, $request, ['file_name']);

        return response()->json($q->orderByDesc('downloaded_at')->paginate($this->perPage($request)));
    }

    public function correspondence(Request $request): JsonResponse
    {
        $q = $this->db()->table('correspondence as c')
            ->leftJoin('correspondence_attachment as a', function ($j) {
                $j->on('a.vendor_no', '=', 'c.vendor_no')->on('a.content_item_id', '=', 'c.content_item_id');
            })
            ->select(
                'c.*',
                'a.id as attachment_id',
                'a.status as attachment_status',
                'a.content_type as attachment_type',
                'a.parse_status',
                'a.parsed_rows',
                'a.file_size as attachment_size',
            );

        if ($request->filled('attachment_type')) {
            $request->attachment_type === 'NONE'
                ? $q->whereNull('a.id')
                : $q->where('a.content_type', $request->attachment_type);
        }
        $this->applyDateRange($q, $request, 'c.new_date_from');
        $this->applySearch($q, $request, ['c.subject', 'c.main_detail', 'c.content_item_id', 'c.attachment']);

        return response()->json(
            $q->orderByRaw('c.new_date_from DESC NULLS LAST')->orderByDesc('c.id')
                ->paginate($this->perPage($request))
        );
    }

    // ── Coupon ──────────────────────────────────────────────────────────────

    public function coupons(Request $request): JsonResponse
    {
        $q = $this->db()->table('correspondence_coupon as cp')->select('cp.*', 'c.subject');
        $this->joinCorrespondenceSubject($q, 'cp');

        if ($request->filled('content_item_id')) {
            $q->where('cp.content_item_id', $request->content_item_id);
        }
        if ($request->filled('promotion_code')) {
            $q->where('cp.promotion_code', $request->promotion_code);
        }
        if ($request->filled('store_code')) {
            $q->where('cp.store_code', $request->store_code);
        }
        $this->applyDateRange($q, $request, 'cp.sale_date');
        $this->applySearch($q, $request, [
            'cp.promotion_code', 'cp.promotion_name', 'cp.ticket', 'cp.article_no', 'cp.article_name',
            'cp.store_code', 'cp.invoice_no', 'c.subject',
        ]);

        return $this->paginateWithTotals(
            $q, $request,
            ['qty' => 'cp.qty', 'net_price' => 'cp.net_price', 'coupon_amount' => 'cp.coupon_amount'],
            ['cp.sale_date' => 'desc', 'cp.content_item_id' => 'desc', 'cp.row_no' => 'asc']
        );
    }

    // ── Leaflet ─────────────────────────────────────────────────────────────

    public function leaflets(Request $request): JsonResponse
    {
        $q = $this->db()->table('correspondence_leaflet as lf')->select('lf.*', 'c.subject');
        $this->joinCorrespondenceSubject($q, 'lf');

        if ($request->filled('content_item_id')) {
            $q->where('lf.content_item_id', $request->content_item_id);
        }
        if ($request->filled('store_code')) {
            $q->where('lf.store_code', $request->store_code);
        }
        $this->applyDateRange($q, $request, 'lf.billing_date');
        $this->applySearch($q, $request, [
            'lf.invoice_no', 'lf.ticket_no', 'lf.article_no', 'lf.article_name',
            'lf.store_code', 'lf.store_name', 'c.subject',
        ]);

        return $this->paginateWithTotals(
            $q, $request,
            [
                'billing_qty'                    => 'lf.billing_qty',
                'billing_amount_before_discount' => 'lf.billing_amount_before_discount',
                'discount_total'                 => 'lf.discount_total',
                'billing_amount'                 => 'lf.billing_amount',
                'leaflet_disc'                   => 'lf.leaflet_disc',
                'leaflet_disc_vat'               => 'lf.leaflet_disc_vat',
            ],
            ['lf.billing_date' => 'desc', 'lf.content_item_id' => 'desc', 'lf.row_no' => 'asc']
        );
    }

    private function applyVendor(Builder $q, Request $request, string $column): void
    {
        if ($request->filled('vendor_no')) {
            $q->where($column, $request->vendor_no);
        }
    }

    // ── PAS (ชำระเงินหลังการขาย) ────────────────────────────────────────────

    public function pasFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('pas_file')
            ->select('id', 'run_id', 'vendor_no', 'period', 'file_name', 'file_size', 'row_count',
                'total_qty', 'total_sales_amount', 'report_updated_at', 'downloaded_at');

        $this->applyVendor($q, $request, 'vendor_no');
        $this->applySearch($q, $request, ['file_name']);

        return response()->json($q->orderByDesc('period')->orderByDesc('downloaded_at')->paginate($this->perPage($request)));
    }

    public function pas(Request $request): JsonResponse
    {
        $q = $this->db()->table('pas as p')->select('p.*');

        // A period may be downloaded more than once — default to the latest file of each period
        $request->filled('file_id')
            ? $q->where('p.file_id', $request->integer('file_id'))
            : $q->whereIn('p.file_id', fn ($sub) => $sub->from('pas_file')->selectRaw('MAX(id)')->groupBy('vendor_no', 'period'));

        $this->applyVendor($q, $request, 'p.vendor_no');
        if ($request->filled('period')) {
            $q->where('p.period', $request->period . '-01');
        }
        if ($request->filled('sales_office')) {
            $q->where('p.sales_office', $request->sales_office);
        }
        $this->applyDateRange($q, $request, 'p.physical_del_date');
        $this->applySearch($q, $request, [
            'p.article_no', 'p.article_desc', 'p.billing_doc', 'p.delivery_number',
            'p.noted_no', 'p.clearing_doc', 'p.vendor_invoice_no', 'p.acc_doc_or_po_no',
        ]);

        return $this->paginateWithTotals(
            $q, $request,
            [
                'qty'                          => 'p.qty',
                'sales_amount'                 => 'p.sales_amount',
                'cost_amount'                  => 'p.cost_amount',
                'vat'                          => 'p.vat',
                'vendor_absorb_promo_discount' => 'p.vendor_absorb_promo_discount',
                'vendor_leaflet'               => 'p.vendor_leaflet',
                'net_paid'                     => 'p.net_paid',
            ],
            ['p.period' => 'desc', 'p.physical_del_date' => 'desc', 'p.row_no' => 'asc']
        );
    }

    public function pasOptions(Request $request): JsonResponse
    {
        $periods = $this->db()->table('pas_file')
            ->when($request->filled('vendor_no'), fn ($q) => $q->where('vendor_no', $request->vendor_no))
            ->distinct()->orderByDesc('period')->pluck('period')
            ->map(fn ($p) => substr($p, 0, 7))->values();
        $offices = $this->db()->table('pas')
            ->when($request->filled('vendor_no'), fn ($q) => $q->where('vendor_no', $request->vendor_no))
            ->whereNotNull('sales_office')->distinct()->orderBy('sales_office')->pluck('sales_office');

        return response()->json(['periods' => $periods, 'sales_offices' => $offices]);
    }

    // ── Receipt (ใบเสร็จรับเงิน) ────────────────────────────────────────────

    public function receiptFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('receipt_file as f')
            ->select('f.id', 'f.run_id', 'f.vendor_no', 'f.fiscal_year', 'f.file_name', 'f.source_file_name',
                'f.file_size', 'f.row_count', 'f.downloaded_at')
            // The yearly Excel is re-downloaded on every run — flag the newest file of each fiscal year
            ->selectRaw('f.id = (SELECT MAX(l.id) FROM receipt_file l WHERE l.vendor_no = f.vendor_no AND l.fiscal_year = f.fiscal_year) as is_latest')
            ->selectRaw('(SELECT COUNT(*) FROM receipt_excel_row r JOIN receipt_document d
                ON d.vendor_no = r.vendor_no AND d.fiscal_year = r.fiscal_year AND d.doc_no = r.payment_doc
                WHERE r.file_id = f.id) as pdf_count');

        $this->applyVendor($q, $request, 'f.vendor_no');
        if ($request->filled('fiscal_year')) {
            $q->where('f.fiscal_year', $request->integer('fiscal_year'));
        }
        if ($request->boolean('latest_only')) {
            $q->whereIn('f.id', fn ($sub) => $sub->from('receipt_file')->selectRaw('MAX(id)')->groupBy('vendor_no', 'fiscal_year'));
        }
        $this->applySearch($q, $request, ['f.file_name', 'f.source_file_name']);

        return response()->json($q->orderByDesc('f.downloaded_at')->paginate($this->perPage($request)));
    }

    /** Excel rows of one receipt file, each with its matching receipt PDF (receipt_document) if downloaded. */
    public function receiptFileRows(int $fileId): JsonResponse
    {
        $rows = $this->db()->table('receipt_excel_row as r')
            ->leftJoin('receipt_document as d', function ($j) {
                $j->on('d.vendor_no', '=', 'r.vendor_no')
                  ->on('d.fiscal_year', '=', 'r.fiscal_year')
                  ->on('d.doc_no', '=', 'r.payment_doc');
            })
            ->where('r.file_id', $fileId)
            ->select(
                'r.*',
                'd.id as doc_id', 'd.doc_no as doc_doc_no', 'd.posting_date as doc_posting_date', 'd.doc_type as doc_doc_type',
                'd.comp_code as doc_comp_code', 'd.customer_no as doc_customer_no', 'd.email as doc_email',
                'd.sap_path as doc_sap_path', 'd.vendor_print_at as doc_vendor_print_at', 'd.status as doc_status',
                'd.file_name as doc_file_name', 'd.source_file_name as doc_source_file_name', 'd.file_size as doc_file_size',
                'd.error as doc_error', 'd.downloaded_at as doc_downloaded_at', 'd.updated_at as doc_updated_at',
            )
            ->orderBy('r.row_no')
            ->get();

        return response()->json($rows);
    }

    public function receiptFiscalYears(Request $request): JsonResponse
    {
        $vendor = fn ($q) => $q->when($request->filled('vendor_no'), fn ($q) => $q->where('vendor_no', $request->vendor_no));
        $years = $vendor($this->db()->table('receipt_file'))->pluck('fiscal_year')
            ->merge($vendor($this->db()->table('receipt_document'))->pluck('fiscal_year'))
            ->filter()->unique()->sortDesc()->values();

        return response()->json(['fiscal_years' => $years]);
    }

    // ── Compensate (ชดเชยราคา) — file → compensate → document → sale item ────

    public function compensateFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('compensate_file as f')
            ->select('f.id', 'f.run_id', 'f.vendor_no', 'f.com_type', 'f.file_name', 'f.source_file_name',
                'f.file_size', 'f.row_count', 'f.downloaded_at')
            // compensate rows are upserted by com_id and re-pointed to the newest file that contains them
            ->selectRaw('(SELECT COUNT(*) FROM compensate c WHERE c.file_id = f.id) as compensate_count');

        $this->applyVendor($q, $request, 'f.vendor_no');
        if ($request->filled('com_type')) {
            $q->where('f.com_type', $request->com_type);
        }
        $this->applySearch($q, $request, ['f.file_name', 'f.source_file_name']);

        return response()->json($q->orderByDesc('f.downloaded_at')->paginate($this->perPage($request)));
    }

    public function compensates(Request $request, int $fileId): JsonResponse
    {
        $q = $this->db()->table('compensate as c')
            ->leftJoin('compensate_document as d', function ($j) {
                $j->on('d.vendor_no', '=', 'c.vendor_no')->on('d.com_id', '=', 'c.com_id');
            })
            ->where('c.file_id', $fileId)
            ->select('c.*', 'd.id as doc_id', 'd.status as doc_status', 'd.row_count as doc_row_count');

        $this->applySearch($q, $request, ['c.com_id', 'c.reference', 'c.reason', 'c.acc_doc_year', 'c.com_group_no']);

        return $this->paginateWithTotals(
            $q, $request,
            ['total_amount' => 'c.total_amount'],
            ['c.start_date' => 'desc', 'c.com_id' => 'desc']
        );
    }

    public function compensateDocuments(Request $request): JsonResponse
    {
        $request->validate(['com_id' => 'required|string']);

        $q = $this->db()->table('compensate_document')
            ->select('id', 'run_id', 'vendor_no', 'com_id', 'status', 'total_amount', 'row_count', 'file_name',
                'source_file_name', 'file_size', 'error', 'downloaded_at', 'updated_at')
            ->where('com_id', $request->com_id);
        $this->applyVendor($q, $request, 'vendor_no');

        return response()->json($q->orderByDesc('downloaded_at')->get());
    }

    public function compensateSaleItems(Request $request, int $documentId): JsonResponse
    {
        $q = $this->db()->table('compensate_sale_item as i')->select('i.*')->where('i.document_id', $documentId);

        $this->applyDateRange($q, $request, 'i.billing_date');
        $this->applySearch($q, $request, ['i.article', 'i.article_desc', 'i.store', 'i.billing_no', 'i.return_document']);

        return $this->paginateWithTotals(
            $q, $request,
            [
                'billing_qty'           => 'i.billing_qty',
                'total_compensate_amt'  => 'i.total_compensate_amt',
                'return_compensate_amt' => 'i.return_compensate_amt',
            ],
            ['i.row_no' => 'asc']
        );
    }

    public function compensateTypes(Request $request): JsonResponse
    {
        $types = $this->db()->table('compensate_file')
            ->when($request->filled('vendor_no'), fn ($q) => $q->where('vendor_no', $request->vendor_no))
            ->whereNotNull('com_type')->distinct()->orderBy('com_type')->pluck('com_type');

        return response()->json($types);
    }

    // ── File download (S3 pre-signed URL) ───────────────────────────────────

    public function download(Request $request): JsonResponse
    {
        // Read by name: routes that fix the type via ->defaults() would otherwise shift positional args
        $type = $request->route('type');
        $id = (int) $request->route('id');

        $file = $this->db()->table(self::FILE_TABLES[$type])
            ->select('file_name', 's3_bucket', 's3_key')
            ->find($id);

        return $this->s3DownloadResponse($file, $request->boolean('inline'));
    }
}
