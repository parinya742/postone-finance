<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LazadaSessionLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('lazada_session_logs as ll')
            ->leftJoin('lazada_transaction_tokens as ltt', 'ltt.short_code', '=', 'll.seller_key')
            ->whereNull('ltt.deleted_at')
            ->select(
                'll.id', 'll.run_id', 'll.platform', 'll.seller_key',
                'll.status', 'll.live', 'll.asc_uid', 'll.reason',
                'll.triggered_by', 'll.duration_ms', 'll.created_at',
                'ltt.shop_name'
            )
            ->orderByDesc('ll.created_at');

        if ($request->filled('seller_key')) {
            $q->where('ll.seller_key', $request->seller_key);
        }

        if ($request->filled('status')) {
            $q->where('ll.status', $request->status);
        }

        if ($request->filled('triggered_by')) {
            $q->where('ll.triggered_by', $request->triggered_by);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('ll.created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('ll.created_at', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
