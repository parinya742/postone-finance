<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * MT — HP-MH RTV (return to vendor) data (connection "hpmh_rtv", schema hpmh_rtv), populated by the n8n scraper.
 *
 * return_slip_file holds both the EXCEL listing (→ return_slip.file_id) and the PDF ZIPs
 * (→ return_slip_document.zip_file_id). A slip and its PDF are linked by (vendor_no, article_doc_no, fiscal year).
 */
class HpmhRtvController extends Controller
{
    use QueriesReportTables;

    private function db()
    {
        return DB::connection('hpmh_rtv');
    }

    private function applyVendor($q, Request $request, string $column): void
    {
        if ($request->filled('vendor_no')) {
            $q->where($column, $request->vendor_no);
        }
    }

    public function returnSlips(Request $request): JsonResponse
    {
        $q = $this->db()->table('return_slip as s')
            ->leftJoin('return_slip_document as d', function ($j) {
                $j->on('d.vendor_no', '=', 's.vendor_no')
                  ->on('d.article_doc_no', '=', 's.article_doc_no')
                  ->whereRaw('d.fiscal_year = EXTRACT(YEAR FROM s.gr_date)');
            })
            ->select('s.*', 'd.id as doc_id', 'd.pdf_file_name as doc_file_name', 'd.file_size as doc_file_size');

        $this->applyVendor($q, $request, 's.vendor_no');
        foreach (['site_code', 'movement_type'] as $col) {
            if ($request->filled($col)) {
                $q->where("s.{$col}", $request->input($col));
            }
        }
        if ($request->filled('has_pdf')) {
            $request->boolean('has_pdf') ? $q->whereNotNull('d.id') : $q->whereNull('d.id');
        }
        $this->applyDateRange($q, $request, 's.gr_date');
        $this->applySearch($q, $request, ['s.article_doc_no', 's.site', 's.created_by']);

        return $this->paginateWithTotals(
            $q, $request,
            ['quantity' => 's.quantity', 'amount' => 's.amount'],
            ['s.gr_date' => 'desc', 's.article_doc_no' => 'desc']
        );
    }

    public function options(Request $request): JsonResponse
    {
        $base = fn () => $this->db()->table('return_slip')
            ->when($request->filled('vendor_no'), fn ($q) => $q->where('vendor_no', $request->vendor_no));

        return response()->json([
            'sites' => $base()->select('site_code', 'site')->whereNotNull('site_code')->distinct()->orderBy('site_code')->get(),
            'movement_types' => $base()->whereNotNull('movement_type')->distinct()->orderBy('movement_type')->pluck('movement_type'),
        ]);
    }

    public function files(Request $request): JsonResponse
    {
        $q = $this->db()->table('return_slip_file as f')
            ->select('f.id', 'f.run_id', 'f.vendor_no', 'f.file_kind', 'f.gr_date_from', 'f.gr_date_to', 'f.file_name',
                'f.source_file_name', 'f.file_size', 'f.row_count', 'f.created_at')
            // slips are upserted and re-pointed to the newest EXCEL; PDFs belong to the ZIP they came from
            ->selectRaw('(SELECT COUNT(*) FROM return_slip s WHERE s.file_id = f.id) as slip_count')
            ->selectRaw('(SELECT COUNT(*) FROM return_slip_document d WHERE d.zip_file_id = f.id) as pdf_count');

        $this->applyVendor($q, $request, 'f.vendor_no');
        if ($request->filled('file_kind')) {
            $q->where('f.file_kind', $request->file_kind);
        }
        $this->applySearch($q, $request, ['f.file_name', 'f.source_file_name']);

        return response()->json($q->orderByDesc('f.created_at')->orderByDesc('f.id')->paginate($this->perPage($request)));
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
            $this->db()->table('return_slip_file')->select('file_name', 's3_bucket', 's3_key')->find($id)
        );
    }

    public function downloadDocument(Request $request, int $id): JsonResponse
    {
        $doc = $this->db()->table('return_slip_document')
            ->select('pdf_file_name as file_name', 's3_bucket', 's3_key')
            ->find($id);

        return $this->s3DownloadResponse($doc, $request->boolean('inline'));
    }
}
