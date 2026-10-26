<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MT — DH daily sales report (connection "dh", schema "DH"), populated by the n8n scraper.
 *
 * sales_report_file (one Excel per report date) 1—n sales_report (article × branch qty)
 * and 1—n sales_report_branch (per-branch qty + sales value; value is only reported per branch).
 */
class DhController extends Controller
{
    use QueriesReportTables;

    private function db()
    {
        return DB::connection('dh');
    }

    private function applyCommon($q, Request $request, string $alias): void
    {
        if ($request->filled('file_id')) {
            $q->where("{$alias}.file_id", $request->integer('file_id'));
        }
        if ($request->filled('branch_name')) {
            $q->where("{$alias}.branch_name", $request->branch_name);
        }
        $this->applyDateRange($q, $request, "{$alias}.report_date");
    }

    public function salesReport(Request $request): JsonResponse
    {
        $q = $this->db()->table('sales_report as s')->select('s.*');

        $this->applyCommon($q, $request, 's');
        $this->applySearch($q, $request, ['s.article_no', 's.article_name', 's.branch_name']);

        return $this->paginateWithTotals(
            $q, $request,
            ['qty' => 's.qty'],
            ['s.report_date' => 'desc', 's.branch_name' => 'asc', 's.article_no' => 'asc']
        );
    }

    public function branches(Request $request): JsonResponse
    {
        $q = $this->db()->table('sales_report_branch as b')->select('b.*');

        $this->applyCommon($q, $request, 'b');
        $this->applySearch($q, $request, ['b.branch_name']);

        return $this->paginateWithTotals(
            $q, $request,
            ['qty' => 'b.qty', 'sales_value' => 'b.sales_value'],
            ['b.report_date' => 'desc', 'b.sales_value' => 'desc']
        );
    }

    public function options(): JsonResponse
    {
        return response()->json([
            'branches' => $this->db()->table('sales_report_branch')->distinct()->orderBy('branch_name')->pluck('branch_name'),
        ]);
    }

    public function files(Request $request): JsonResponse
    {
        $q = $this->db()->table('sales_report_file')
            ->select('id', 'run_id', 'vendor_no', 'report_date', 'file_name', 'source_file_name', 'file_size',
                'product_count', 'row_count', 'total_qty', 'total_value', 'downloaded_at');

        $this->applyDateRange($q, $request, 'report_date');
        $this->applySearch($q, $request, ['file_name', 'source_file_name']);

        return response()->json($q->orderByDesc('report_date')->orderByDesc('downloaded_at')->paginate($this->perPage($request)));
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
            $this->db()->table('sales_report_file')->select('file_name', 's3_bucket', 's3_key')->find($id)
        );
    }
}
