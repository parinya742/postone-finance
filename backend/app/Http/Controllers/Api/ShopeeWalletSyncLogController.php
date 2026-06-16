<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeWalletSyncLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_wallet_sync_log')
            ->orderByDesc('created_at');

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('status')) {
            $q->where('status', $request->status);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('created_at', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('created_at', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
