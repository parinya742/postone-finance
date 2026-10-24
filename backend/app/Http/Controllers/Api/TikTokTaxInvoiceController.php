<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\QueriesReportTables;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TikTokTaxInvoiceController extends Controller
{
    use QueriesReportTables;

    public function index(Request $request): JsonResponse
    {
        $shopNames = DB::connection('n8n')
            ->table('tiktok_transaction_tokens')
            ->selectRaw('DISTINCT ON (shops_code) shops_code, seller_name')
            ->whereNotNull('shops_code')
            ->orderBy('shops_code')
            ->orderByDesc('updated_at');

        $docCounts = DB::connection('n8n')
            ->table('tiktok_tax_invoice_document')
            ->selectRaw('file_id, COUNT(*) AS document_count')
            ->groupBy('file_id');

        $q = DB::connection('n8n')
            ->table('tiktok_tax_invoice_file as f')
            ->leftJoinSub($shopNames, 's', 's.shops_code', '=', 'f.shop_code')
            ->leftJoinSub($docCounts, 'dc', 'dc.file_id', '=', 'f.id')
            ->select('f.*', 's.seller_name as shop_name', DB::raw('COALESCE(dc.document_count, 0) AS document_count'))
            ->orderByDesc('f.period_to')
            ->orderBy('f.invoice_type')
            ->orderBy('f.part_no');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('f.file_name', 'ilike', "%{$s}%")
                   ->orWhere('f.source_file_name', 'ilike', "%{$s}%")
                   ->orWhere('f.shop_code', 'ilike', "%{$s}%")
                   ->orWhere('s.seller_name', 'ilike', "%{$s}%")
                   // Find the zip that contains a given document number
                   ->orWhereExists(function ($sub) use ($s) {
                       $sub->selectRaw('1')
                           ->from('tiktok_tax_invoice_document as d')
                           ->whereColumn('d.file_id', 'f.id')
                           ->where('d.document_no', 'ilike', "%{$s}%");
                   });
            });
        }

        if ($request->filled('shop_code')) {
            $q->where('f.shop_code', $request->shop_code);
        }

        if ($request->filled('invoice_type')) {
            $q->where('f.invoice_type', $request->invoice_type);
        }

        // period_* are 'YYYY-MM' text, so string comparison orders correctly
        if ($request->filled('period_from')) {
            $q->where('f.period_to', '>=', $request->period_from);
        }

        if ($request->filled('period_to')) {
            $q->where('f.period_from', '<=', $request->period_to);
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function documents(Request $request, int $fileId): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('tiktok_tax_invoice_document')
            ->where('file_id', $fileId)
            ->orderBy('document_no');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('document_no', 'ilike', "%{$s}%")
                   ->orWhere('file_name', 'ilike', "%{$s}%");
            });
        }

        return response()->json($q->get());
    }

    /** Presigned URL that forces a download with the real file name (S3 has no CORS, so the browser can't do it). */
    public function documentDownload(int $id): JsonResponse
    {
        $doc = DB::connection('n8n')->table('tiktok_tax_invoice_document')->where('id', $id)->first();

        return $this->s3DownloadResponse($doc);
    }

    public function types(): JsonResponse
    {
        $types = DB::connection('n8n')
            ->table('tiktok_tax_invoice_file')
            ->whereNotNull('invoice_type')
            ->distinct()
            ->orderBy('invoice_type')
            ->pluck('invoice_type');

        return response()->json($types);
    }
}
