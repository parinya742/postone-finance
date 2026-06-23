<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeSessionLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_session_logs as sl')
            ->leftJoin('shopee_transaction_tokens as stt', 'stt.shop_id', '=', 'sl.seller_key')
            ->select(
                'sl.id', 'sl.run_id', 'sl.seller_key', 'sl.status',
                'sl.missing', 'sl.reason', 'sl.triggered_by', 'sl.duration_ms', 'sl.created_at',
                DB::raw('COALESCE(stt.shop_name, sl.seller_key) as shop_name')
            )
            ->orderByDesc('sl.created_at');

        if ($request->filled('seller_key')) {
            $q->where('sl.seller_key', $request->seller_key);
        }

        if ($request->filled('status')) {
            $q->where('sl.status', $request->status);
        }

        if ($request->filled('triggered_by')) {
            $q->where('sl.triggered_by', $request->triggered_by);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('sl.created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('sl.created_at', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
