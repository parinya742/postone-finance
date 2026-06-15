<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeWalletFileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_wallet_file')
            ->select([
                'id', 'shop_id', 'shop_name', 'range_from', 'range_to',
                's3_bucket', 's3_key', 's3_url', 'row_count', 'created_at',
            ])
            ->orderByDesc('created_at');

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('start_date')) {
            $q->where('range_from', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('range_to', '<=', $request->end_date);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
