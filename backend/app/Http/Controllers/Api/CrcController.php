<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MT — CRC data (connection "crc", schema crc), populated by the n8n CRC scraper.
 */
class CrcController extends Controller
{
    use QueriesReportTables;

    private const FILE_TABLES = [
        'price-compensate' => 'price_compensate_file',
        'remittance'       => 'remittance_file',
        'summary-report'   => 'summary_report_file',
    ];

    private function db()
    {
        return DB::connection('crc');
    }

    // ── Price Compensate ────────────────────────────────────────────────────

    public function priceCompensateFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('price_compensate_file')
            ->select('id', 'run_id', 'start_date', 'end_date', 'file_name', 'file_size', 'row_count', 'downloaded_at');

        $this->applySearch($q, $request, ['file_name']);
        if ($request->filled('start_date')) {
            $q->where('end_date', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $q->where('start_date', '<=', $request->end_date);
        }

        return response()->json($q->orderByDesc('downloaded_at')->paginate($this->perPage($request)));
    }

    public function priceCompensate(Request $request): JsonResponse
    {
        $q = $this->db()->table('price_compensate');

        if ($request->filled('file_id')) {
            $q->where('file_id', $request->integer('file_id'));
        }
        if ($request->filled('promotion_type')) {
            $q->where('promotion_type', $request->promotion_type);
        }
        if ($request->filled('store_code')) {
            $q->where('store_code', $request->store_code);
        }
        $this->applyDateRange($q, $request, 'sales_date');
        $this->applySearch($q, $request, [
            'promotion_no', 'promotion_name', 'sku', 'product_name', 'store_code', 'store_name', 'ticket_pos', 'brand',
        ]);

        return $this->paginateWithTotals($q, $request, ['cps_qty', 'cps_amount'], ['sales_date' => 'desc', 'id' => 'asc']);
    }

    // ── Remittance ──────────────────────────────────────────────────────────

    public function remittanceFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('remittance_file')
            ->select('id', 'run_id', 'file_name', 'file_size', 'cheque_count', 'row_count', 'downloaded_at');

        $this->applySearch($q, $request, ['file_name']);
        $this->applyDateRange($q, $request, 'downloaded_at');

        return response()->json($q->orderByDesc('downloaded_at')->paginate($this->perPage($request)));
    }

    public function remittance(Request $request): JsonResponse
    {
        $q = $this->db()->table('remittance');

        if ($request->filled('file_id')) {
            $q->where('file_id', $request->integer('file_id'));
        }
        if ($request->filled('cheque_number')) {
            $q->where('cheque_number', $request->cheque_number);
        }
        $this->applyDateRange($q, $request, 'rdate');
        $this->applySearch($q, $request, [
            'rnum', 'cheque_number', 'invoice_number', 'grt_number', 'description', 'branch_name',
        ]);

        return $this->paginateWithTotals(
            $q, $request, ['amount', 'discount_taken', 'amount_due'], ['rdate' => 'desc', 'rnum' => 'asc', 'id' => 'asc']
        );
    }

    // ── Summary Report ──────────────────────────────────────────────────────

    public function summaryReportFiles(Request $request): JsonResponse
    {
        $q = $this->db()->table('summary_report_file')
            ->select(
                'id', 'run_id', 'report_type', 'report_month', 'report_date', 'last_update', 'vendor',
                'file_name', 'file_size', 'row_count', 'downloaded_at'
            );

        if ($request->filled('report_type')) {
            $q->where('report_type', strtoupper($request->report_type));
        }
        if ($request->filled('report_month')) {
            $q->where('report_month', $request->report_month);
        }
        $this->applySearch($q, $request, ['file_name', 'vendor']);

        return response()->json(
            $q->orderByDesc('report_month')->orderByDesc('report_date')->orderByDesc('downloaded_at')
                ->paginate($this->perPage($request))
        );
    }

    private function applySummaryFilters(Builder $q, Request $request): void
    {
        if ($request->filled('file_id')) {
            $q->where('file_id', $request->integer('file_id'));
        }
        if ($request->filled('store_code')) {
            $q->where('store_code', $request->store_code);
        }
        if ($request->filled('product_type')) {
            $q->where('product_type', $request->product_type);
        }
        $this->applySearch($q, $request, ['sku', 'barcode', 'description', 'brand', 'store_code', 'store_name']);
    }

    public function summaryReport(Request $request): JsonResponse
    {
        $q = $this->db()->table('summary_report');

        if ($request->filled('report_month')) {
            $q->where('report_month', $request->report_month);
        }
        $this->applySummaryFilters($q, $request);

        return $this->paginateWithTotals(
            $q, $request, ['sales_amount', 'sales_qty', 'stock_on_hand', 'stock_on_order'],
            ['report_month' => 'desc', 'store_code' => 'asc', 'sku' => 'asc']
        );
    }

    public function summaryReportDaily(Request $request): JsonResponse
    {
        $q = $this->db()->table('summary_report_daily');

        $this->applyDateRange($q, $request, 'report_date');
        $this->applySummaryFilters($q, $request);

        return $this->paginateWithTotals(
            $q, $request, ['sales_amount', 'sales_qty', 'stock_on_hand', 'stock_on_order'],
            ['report_date' => 'desc', 'store_code' => 'asc', 'sku' => 'asc']
        );
    }

    // ── Scraper run log ─────────────────────────────────────────────────────

    public function auditLogs(Request $request): JsonResponse
    {
        return $this->auditLogResponse($this->db()->table('audit_log'), $request);
    }

    public function auditLogTopics(): JsonResponse
    {
        return $this->auditLogTopicsResponse($this->db()->table('audit_log'));
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

        return $this->s3DownloadResponse($file);
    }
}
