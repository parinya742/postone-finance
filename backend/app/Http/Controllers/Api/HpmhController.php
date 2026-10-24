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

    // ── File download (S3 pre-signed URL) ───────────────────────────────────

    public function download(string $type, int $id): JsonResponse
    {
        $file = $this->db()->table(self::FILE_TABLES[$type])
            ->select('file_name', 's3_bucket', 's3_key')
            ->find($id);

        return $this->s3DownloadResponse($file);
    }
}
