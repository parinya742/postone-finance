<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeEtaxController extends Controller
{
    private function fileQuery()
    {
        return DB::connection('n8n')
            ->table('shopee_etax_file as sef')
            ->leftJoin('shopee_transaction_tokens as stt', 'stt.shop_id', '=', 'sef.shop_id')
            ->select('sef.*', 'stt.shop_name');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->fileQuery()
            ->orderByDesc('sef.range_to')
            ->orderByDesc('sef.created_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('sef.file_name', 'ilike', "%{$s}%")
                   ->orWhere('stt.shop_name', 'ilike', "%{$s}%")
                   ->orWhere('sef.shop_id', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('stt.shop_name', $request->shop_name);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('sef.range_from', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('sef.range_to', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function documents(Request $request, int $fileId): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_etax_document')
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
}
