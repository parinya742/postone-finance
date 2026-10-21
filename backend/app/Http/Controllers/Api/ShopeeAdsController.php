<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeAdsController extends Controller
{
    private function fileQuery()
    {
        return DB::connection('n8n')
            ->table('shopee_ads_billing_file as sab')
            ->leftJoin('shopee_transaction_tokens as stt', 'stt.shop_id', '=', 'sab.shop_id')
            ->select('sab.*', 'stt.shop_name');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->fileQuery()
            ->orderByDesc('sab.range_to')
            ->orderByDesc('sab.created_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('sab.file_name', 'ilike', "%{$s}%")
                   ->orWhere('stt.shop_name', 'ilike', "%{$s}%")
                   ->orWhere('sab.shop_id', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('stt.shop_name', $request->shop_name);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('sab.range_from', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('sab.range_to', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function transactions(Request $request, int $fileId): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_ads_transaction')
            ->where('file_id', $fileId)
            ->orderBy('id');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('txn_type', 'ilike', "%{$s}%")
                   ->orWhere('remark', 'ilike', "%{$s}%");
            });
        }

        return response()->json($q->get());
    }

    // รายการ "เอกสาร" — ธุรกรรมโฆษณาทั้งหมดของทุกไฟล์บิล รวมกันเป็นลิสต์เดียว พร้อมบริบทไฟล์/ร้านค้า
    // ใช้สำหรับหน้า all-documents ที่ค้นหา/กรองช่วงวันที่/Export ได้โดยไม่ต้องไล่เปิดทีละไฟล์
    public function allTransactions(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_ads_transaction as sat')
            ->leftJoin('shopee_ads_billing_file as sab', 'sab.id', '=', 'sat.file_id')
            ->leftJoin('shopee_transaction_tokens as stt', 'stt.shop_id', '=', 'sat.shop_id')
            ->select(
                'sat.*',
                'sab.file_name',
                'sab.range_from as file_range_from',
                'sab.range_to as file_range_to',
                'stt.shop_name'
            )
            ->orderByDesc('sat.txn_date')
            ->orderByDesc('sat.id');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('sat.txn_type', 'ilike', "%{$s}%")
                   ->orWhere('sat.remark', 'ilike', "%{$s}%")
                   ->orWhere('stt.shop_name', 'ilike', "%{$s}%")
                   ->orWhere('sat.shop_id', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('stt.shop_name', $request->shop_name);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('sat.txn_date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('sat.txn_date', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
