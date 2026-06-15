<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeWalletTransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_wallet_transactions')
            ->select([
                'id', 'shop_id', 'shop_name', 'range_from', 'range_to',
                'transaction_id', 'status', 'wallet_type', 'transaction_type',
                'transaction_tab_type', 'money_flow', 'amount', 'current_balance',
                'transaction_fee', 'create_time', 'order_sn', 'refund_sn',
                'withdrawal_id', 'withdrawal_type', 'description', 'reason',
                'buyer_name', 'buyer_username', 'order_status',
                'pay_time', 'complete_time', 'shipping_method', 'tracking_no',
                'net_price', 'commission_fee', 'order_transaction_fee',
                'buyer_paid_price', 'actual_shipping_fee', 'escrow_amount',
                'shopee_shipping_subsidy', 'service_fee', 'return_shipping_fee',
                'seller_voucher', 'shopee_voucher', 'shopee_discount',
                'created_at',
            ])
            ->orderByDesc('create_time');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('transaction_id', 'ilike', "%{$s}%")
                   ->orWhere('order_sn', 'ilike', "%{$s}%")
                   ->orWhere('buyer_username', 'ilike', "%{$s}%")
                   ->orWhere('buyer_name', 'ilike', "%{$s}%")
                   ->orWhere('description', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('start_date')) {
            $q->whereDate('create_time', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->whereDate('create_time', '<=', $request->end_date);
        }

        if ($request->filled('transaction_type')) {
            $q->where('transaction_type', 'ilike', "%{$request->transaction_type}%");
        }

        if ($request->filled('money_flow')) {
            $q->where('money_flow', $request->money_flow);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
