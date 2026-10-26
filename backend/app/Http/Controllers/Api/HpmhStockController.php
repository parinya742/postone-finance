<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MT — HP-MH Stock (connection "hpmh_stock", schema hpmh_stock), populated by the n8n scraper.
 *
 * inventory_export_file (ZIP) 1—n inventory_export_csv 1—n inventory_export (one row per article × site per stock date).
 */
class HpmhStockController extends Controller
{
    use QueriesReportTables;

    private function db()
    {
        return DB::connection('hpmh_stock');
    }

    public function inventory(Request $request): JsonResponse
    {
        $q = $this->db()->table('inventory_export as i')->select('i.*');

        if ($request->filled('vendor_no')) {
            $q->where('i.vendor_no', $request->vendor_no);
        }
        // Default to the latest stock date — each date is a full snapshot, summing across dates double-counts
        $request->filled('stock_date')
            ? $q->where('i.stock_date', $request->stock_date)
            : $q->where('i.stock_date', fn ($sub) => $sub->from('inventory_export')->selectRaw('MAX(stock_date)')
                ->when($request->filled('vendor_no'), fn ($s) => $s->where('vendor_no', $request->vendor_no)));
        foreach (['file_id', 'csv_id'] as $col) {
            if ($request->filled($col)) {
                $q->where("i.{$col}", $request->integer($col));
            }
        }
        foreach (['site_no', 'mch3', 'non_move_type'] as $col) {
            if ($request->filled($col)) {
                $q->where("i.{$col}", $request->input($col));
            }
        }
        if ($request->boolean('in_stock')) {
            $q->where('i.onhand_qty', '>', 0);
        }
        $this->applySearch($q, $request, [
            'i.art_no', 'i.art_desc', 'i.art_ean', 'i.vd_art_no', 'i.vd_art_desc', 'i.site_name', 'i.site_no',
        ]);

        return $this->paginateWithTotals(
            $q, $request,
            [
                'onhand_qty'            => 'i.onhand_qty',
                'onhand_value'          => 'i.onhand_value',
                'stock_available_qty'   => 'i.stock_available_qty',
                'stock_available_value' => 'i.stock_available_value',
                'rtv_qty'               => 'i.rtv_qty',
                'rtv_value'             => 'i.rtv_value',
                'avg_sale_qty_8w'       => 'i.avg_sale_qty_8w',
                'avg_sale_amt_8w'       => 'i.avg_sale_amt_8w',
            ],
            ['i.onhand_value' => 'desc', 'i.art_no' => 'asc', 'i.site_no' => 'asc']
        );
    }

    public function options(Request $request): JsonResponse
    {
        $base = fn () => $this->db()->table('inventory_export')
            ->when($request->filled('vendor_no'), fn ($q) => $q->where('vendor_no', $request->vendor_no));

        return response()->json([
            'stock_dates' => $base()->distinct()->orderByDesc('stock_date')->pluck('stock_date'),
            'sites' => $base()->select('site_no', 'site_name')->whereNotNull('site_no')->distinct()->orderBy('site_no')->get(),
            'mch3' => $base()->select('mch3', 'mch2_desc')->whereNotNull('mch3')->distinct()->orderBy('mch3')->get(),
            'non_move_types' => $base()->whereNotNull('non_move_type')->distinct()->pluck('non_move_type'),
        ]);
    }

    public function files(Request $request): JsonResponse
    {
        $q = $this->db()->table('inventory_export_file')
            ->select('id', 'run_id', 'vendor_no', 'stock_date', 'file_name', 'source_file_name', 'csv_count', 'file_size',
                'row_count', 'total_onhand_qty', 'total_onhand_value', 'downloaded_at');

        if ($request->filled('vendor_no')) {
            $q->where('vendor_no', $request->vendor_no);
        }
        $this->applySearch($q, $request, ['file_name', 'source_file_name']);

        return response()->json($q->orderByDesc('stock_date')->orderByDesc('downloaded_at')->paginate($this->perPage($request)));
    }

    public function fileCsvs(int $fileId): JsonResponse
    {
        return response()->json(
            $this->db()->table('inventory_export_csv')->where('file_id', $fileId)->orderBy('id')->get()
        );
    }

    public function auditLogs(Request $request): JsonResponse
    {
        return $this->auditLogResponse($this->db()->table('audit_log'), $request);
    }

    public function auditLogTopics(): JsonResponse
    {
        return $this->auditLogTopicsResponse($this->db()->table('audit_log'));
    }

    public function downloadFile(int $id): JsonResponse
    {
        return $this->s3DownloadResponse(
            $this->db()->table('inventory_export_file')->select('file_name', 's3_bucket', 's3_key')->find($id)
        );
    }
}
