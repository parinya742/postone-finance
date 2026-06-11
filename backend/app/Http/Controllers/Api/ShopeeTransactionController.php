<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeTransactionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_income_payout')
            ->select([
                'order_sn', 'return_sn', 'buyer_username', 'order_date',
                'payment_method', 'payment_detail', 'payout_date',
                'original_price', 'seller_discount', 'refund_to_buyer',
                'shopee_discount', 'seller_voucher', 'ams_commission',
                'commission_fee', 'service_fee', 'transaction_fee', 'tax',
                'total_payout', 'shipping_provider', 'carrier_name',
                'shop_id', 'shop_name', 'file_id', 'updated_at',
            ])
            ->orderByDesc('payout_date')
            ->orderByDesc('order_date');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('order_sn', 'ilike', "%{$s}%")
                   ->orWhere('buyer_username', 'ilike', "%{$s}%")
                   ->orWhere('return_sn', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('start_date')) {
            $q->where('payout_date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('payout_date', '<=', $request->end_date);
        }

        if ($request->filled('payment_method')) {
            $q->where('payment_method', $request->payment_method);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
