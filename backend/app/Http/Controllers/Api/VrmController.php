<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Other → ติดตามงาน PC → VRM (HomePro vendor portal sales), EDI database schema "vrm".
 *
 * vrm.import_batch               — one row per imported VRM export file (history / freshness)
 * vrm.article_channel_sales_daily — the sales facts; PK (period_type, period_date, vendor_no, site_no, art_no, sale_type),
 *                                   so re-imports overwrite instead of duplicating. batch_id → import_batch.id
 *
 * Mirrors the n8n "vrm-export" workbook: ArticleByChannelType / Pivot ART / line_orders / Pivot_line_orders.
 */
class VrmController extends Controller
{
    use QueriesReportTables;

    private function edi(): \Illuminate\Database\Connection
    {
        return DB::connection('edi');
    }

    /** Validated date range; defaults to the range of the latest loaded batch. */
    private function range(Request $request): array
    {
        $latest = $this->edi()->table('vrm.import_batch')
            ->where('status', 'loaded')
            ->orderByDesc('exported_at')
            ->first(['date_from', 'date_to']);

        $from = $request->date('date_from')?->toDateString() ?? $latest?->date_from ?? now()->startOfMonth()->toDateString();
        $to   = $request->date('date_to')?->toDateString() ?? $latest?->date_to ?? now()->toDateString();

        return [$from, $to];
    }

    /** Sales facts filtered by date range / site / sale type / article. */
    private function facts(Request $request, string $from, string $to): Builder
    {
        $q = $this->edi()->table('vrm.article_channel_sales_daily as f')
            ->whereBetween('f.period_date', [$from, $to]);

        $site = strtoupper(trim((string) $request->query('site', '')));
        if ($site !== '' && $site !== 'ALL') {
            $q->where('f.site_no', $site);
        }
        if ($request->filled('sale_type')) {
            $q->where('f.sale_type', $request->query('sale_type'));
        }
        if ($request->filled('art_no')) {
            $q->where('f.art_no', $request->query('art_no'));
        }

        return $q;
    }

    // GET /pc-tracking/vrm/options — dropdowns + latest batch info
    public function options(): JsonResponse
    {
        $e = $this->edi();

        return response()->json([
            'sites'      => $e->table('vrm.site')->orderBy('site_no')->get(['site_no', 'site_name']),
            'articles'   => $e->table('vrm.article')->orderBy('art_desc')->get(['art_no', 'art_desc', 'vd_art_desc']),
            'sale_types' => $e->table('vrm.channel_type')->orderBy('code')->get(['code', 'description']),
            'latest_batch' => $e->table('vrm.import_batch')
                ->where('status', 'loaded')
                ->orderByDesc('exported_at')
                ->first(['id', 'date_from', 'date_to', 'exported_at', 'row_count', 'file_name']),
        ]);
    }

    // GET /pc-tracking/vrm/pivot — Pivot ART: rows SITENO → PERIODDATE, values Sum of QTY / Sum of VALUE
    public function pivot(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $rows = $this->facts($request, $from, $to)
            ->groupBy('f.site_no', 'f.period_date')
            ->orderBy('f.site_no')
            ->orderBy('f.period_date')
            ->get([
                'f.site_no',
                'f.period_date',
                DB::raw('SUM(f.qty)::float AS qty'),
                DB::raw('SUM(f.value)::float AS value'),
            ]);

        $siteNames = $this->edi()->table('vrm.site')->pluck('site_name', 'site_no');

        $sites = $rows->groupBy('site_no')->map(fn ($days, $siteNo) => [
            'site_no'   => $siteNo,
            'site_name' => $siteNames[$siteNo] ?? null,
            'qty'       => round($days->sum('qty'), 3),
            'value'     => round($days->sum('value'), 2),
            'days'      => $days->map(fn ($d) => [
                'period_date' => $d->period_date,
                'qty'         => $d->qty,
                'value'       => $d->value,
            ])->values(),
        ])->values();

        return response()->json([
            'date_from' => $from,
            'date_to'   => $to,
            'sites'     => $sites,
            'total'     => [
                'qty'   => round($rows->sum('qty'), 3),
                'value' => round($rows->sum('value'), 2),
            ],
        ]);
    }

    // GET /pc-tracking/vrm/export — raw rows for the 4-sheet workbook (built client-side)
    public function export(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $raw = $this->facts($request, $from, $to)
            ->leftJoin('vrm.vendor as v', 'v.vendor_no', '=', 'f.vendor_no')
            ->leftJoin('vrm.site as s', 's.site_no', '=', 'f.site_no')
            ->leftJoin('vrm.article as a', 'a.art_no', '=', 'f.art_no')
            ->leftJoin('vrm.merch_category as mc', 'mc.mch1', '=', 'f.mch1')
            ->leftJoin('vrm.import_batch as b', 'b.id', '=', 'f.batch_id')
            ->orderBy('f.site_no')->orderBy('f.art_no')->orderBy('f.period_date')->orderBy('f.sale_type')
            ->get([
                DB::raw("to_char(b.exported_at AT TIME ZONE 'Asia/Bangkok', 'DDMMYYYY') AS today"),
                DB::raw("to_char(b.exported_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') AS crdate"),
                'f.period_type', 'f.period_date', 'f.billing_date',
                'f.vendor_no', 'v.vendor_name', 'f.site_no', 's.site_name',
                'mc.mch3', 'mc.mch3_desc', 'mc.mch2', 'mc.mch2_desc', 'f.mch1', 'mc.mch1_desc',
                'f.art_no', 'a.art_desc', 'a.art_ean', 'a.vd_art_desc',
                DB::raw('f.qty::float AS qty'), DB::raw('f.value::float AS value'),
                'f.uom', 'a.vd_art_no', 'f.sale_type',
            ]);

        // LINE orders reported by PCs in the same period (and branch, when one is selected)
        $site = strtoupper(trim((string) $request->query('site', '')));
        $lineOrders = $this->edi()->table('line_order_messages as o')
            ->leftJoin('line_users as u', 'u.user_id', '=', 'o.user_id')
            ->leftJoin('line_groups as g', 'g.group_id', '=', 'o.group_id')
            ->whereBetween('o.order_date_iso', [$from, $to])
            ->whereIn('o.group_id', PcTrackingController::lineGroupIds())
            ->when($site !== '' && $site !== 'ALL', fn ($q) => $q->where('o.branch_code', $site))
            ->orderByDesc('o.parsed_at')
            ->get([
                'o.parsed_at', 'o.order_date_iso', 'o.branch_code', 'o.sku',
                DB::raw('o.quantity::float AS quantity'), DB::raw('o.amount::float AS amount'),
                DB::raw('COALESCE(g.group_name, o.group_id) AS group_name'),
                'u.display_name', 'o.raw_text',
            ]);

        AuditLog::record('export', 'vrm_sales', 0, 'VRM Sales Pivot', [
            'date_from' => $from,
            'date_to'   => $to,
            'site'      => $request->query('site'),
            'sale_type' => $request->query('sale_type'),
            'art_no'    => $request->query('art_no'),
            'record_count' => $raw->count(),
        ]);

        // ~27k rows/month: send raw as column list + value arrays (repeating 24 keys per row doubles the payload)
        $rawColumns = $raw->isEmpty() ? [] : array_keys((array) $raw->first());

        return response()->json([
            'date_from'   => $from,
            'date_to'     => $to,
            'raw_columns' => $rawColumns,
            'raw'         => $raw->map(fn ($r) => array_values((array) $r)),
            'line_orders' => $lineOrders,
        ], 200, [], JSON_UNESCAPED_UNICODE); // Thai as UTF-8 (3 bytes) instead of \uXXXX (6 bytes)
    }

    /**
     * GET /pc-tracking/vrm/batches/{id}/download — original VRM file kept on S3.
     * Returns a 10-minute pre-signed link (the object's public file_url is never handed out).
     */
    public function downloadBatch(int $id): JsonResponse
    {
        $batch = $this->edi()->table('vrm.import_batch')->where('id', $id)->first(['id', 'file_name', 's3_key', 'file_url']);
        if (! $batch || ! $batch->s3_key) {
            return response()->json(['message' => 'ไม่มีไฟล์ต้นฉบับบน S3 — ใช้การสร้างไฟล์จากข้อมูลที่นำเข้าแทน'], 404);
        }

        // Bucket comes from file_url (https://{bucket}.s3.{region}.amazonaws.com/...); null → default disk bucket
        $bucket = preg_match('#^https?://([^.]+)\.s3[.-]#', (string) $batch->file_url, $m) ? $m[1] : null;

        AuditLog::record('download', 'vrm_import_batch', $batch->id, $batch->file_name ?? "batch #{$batch->id}", [
            'source' => 's3',
            's3_key' => $batch->s3_key,
        ]);

        return $this->s3DownloadResponse((object) [
            'file_name' => $batch->file_name ?: basename($batch->s3_key),
            's3_bucket' => $bucket,
            's3_key'    => $batch->s3_key,
        ]);
    }

    /**
     * GET /pc-tracking/vrm/batches/{id}/rows — the batch's rows exactly as imported (vrm.stg_article_channel_raw),
     * for rebuilding the file when there is no S3 copy. Column names match the VRM file header (uppercased client-side).
     */
    public function batchRows(int $id): JsonResponse
    {
        $batch = $this->edi()->table('vrm.import_batch')->where('id', $id)->first(['id', 'file_name']);
        if (! $batch) {
            return response()->json(['message' => 'ไม่พบ batch'], 404);
        }

        $columns = ['today', 'crdate', 'periodtype', 'perioddate', 'billing_date', 'vendorno', 'vendorname',
            'siteno', 'sitename', 'mch3', 'mch3desc', 'mch2', 'mch2desc', 'mch1', 'mch1desc',
            'artno', 'artdesc', 'artean', 'vdartdesc', 'qty', 'value', 'uom', 'vdartno', 'sale_type'];

        $rows = $this->edi()->table('vrm.stg_article_channel_raw')
            ->where('batch_id', $id)
            ->orderBy('row_no')
            ->get($columns)
            ->map(fn ($r) => array_values((array) $r));

        AuditLog::record('download', 'vrm_import_batch', $batch->id, $batch->file_name ?? "batch #{$batch->id}", [
            'source' => 'rebuilt_from_staging',
            'record_count' => $rows->count(),
        ]);

        return response()->json([
            'file_name' => $batch->file_name ?: "VRM_batch_{$id}.xlsx",
            'columns'   => $columns,
            'rows'      => $rows,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    // GET /pc-tracking/vrm/batches — SELECT * FROM vrm.import_batch
    public function batches(Request $request): JsonResponse
    {
        $q = $this->edi()->table('vrm.import_batch')
            ->leftJoinSub(
                $this->edi()->table('vrm.article_channel_sales_daily')
                    ->select('batch_id', DB::raw('COUNT(*) AS live_rows'))
                    ->groupBy('batch_id'),
                'live', 'live.batch_id', '=', 'vrm.import_batch.id'
            )
            ->select('vrm.import_batch.*', DB::raw('COALESCE(live.live_rows, 0) AS live_rows'))
            ->orderByDesc('vrm.import_batch.id');

        if ($request->filled('status')) {
            $q->where('vrm.import_batch.status', $request->query('status'));
        }
        if ($request->filled('search')) {
            $like = '%' . addcslashes(trim($request->string('search')->toString()), '%_\\') . '%';
            $q->where(fn ($w) => $w->where('vrm.import_batch.file_name', 'ilike', $like)
                ->orWhere('vrm.import_batch.error_message', 'ilike', $like));
        }
        if ($request->filled('date_from')) {
            $q->where('vrm.import_batch.date_to', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $q->where('vrm.import_batch.date_from', '<=', $request->date_to);
        }

        return response()->json($q->paginate(max(1, min($request->integer('per_page', 20), 200))));
    }
}
