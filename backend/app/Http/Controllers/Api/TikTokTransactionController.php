<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TikTokTransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('tiktok_transactions')
            ->select([
                'id', 'shop_name', 'seller_id', 'shops_code', 'order_id',
                'transaction_type', 'order_create_time', 'order_paid_time',
                'currency', 'total_payment_amount', 'revenue_amount',
                'settlement_amount', 'net_sales_amount', 'fee_amount',
                'shipping_cost_amount', 'total_fee', 'tiktok_commission',
                'seller_discount', 'payment_status', 'payment_id',
                'statement_id', 'payment_time', 'statement_time', 'file_id',
            ])
            ->orderByDesc('payment_time')
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('order_id', 'ilike', "%{$s}%")
                   ->orWhere('payment_id', 'ilike', "%{$s}%")
                   ->orWhere('statement_id', 'ilike', "%{$s}%")
                   ->orWhere('transaction_type', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('transaction_type')) {
            $q->where('transaction_type', $request->transaction_type);
        }

        if ($request->filled('start_date')) {
            $q->where('payment_time', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('payment_time', '<=', $request->end_date . ' 23:59:59');
        }

        if ($request->filled('payment_status')) {
            $q->where('payment_status', $request->payment_status);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
