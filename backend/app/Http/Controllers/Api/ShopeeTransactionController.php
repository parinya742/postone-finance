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
                'payment_method', 'hot_listing', 'payment_detail', 'instalment_plan', 'fee_pct',
                'payout_date', 'original_price', 'seller_discount', 'refund_to_buyer',
                'shopee_discount', 'seller_voucher', 'seller_cojoint_voucher',
                'coins_cashback_seller', 'coins_cashback_cojoint',
                'buyer_shipping_fee', 'shopee_shipping_subsidy', 'shopee_paid_shipping_on_behalf',
                'return_shipping_fee', 'return_shipping_seller', 'return_shipping_program',
                'ams_commission', 'commission_fee', 'service_fee', 'platform_infra_fee',
                'free_shipping_program_fee', 'transaction_fee', 'tax', 'ads_escrow_topup',
                'installation_fee_buyer', 'installation_fee_actual', 'trade_in_bonus',
                'total_payout', 'voucher_code', 'lost_compensation', 'seller_shipping_promo',
                'shipping_provider', 'carrier_name',
                'refund_to_buyer_return', 'coins_used_return', 'shopee_voucher_return',
                'credit_promo_return1', 'credit_promo_return2',
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

        if ($request->filled('order_start_date')) {
            $q->where('order_date', '>=', $request->order_start_date);
        }

        if ($request->filled('order_end_date')) {
            $q->where('order_date', '<=', $request->order_end_date);
        }

        if ($request->filled('payment_method')) {
            $q->where('payment_method', 'ilike', '%' . $request->payment_method . '%');
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
