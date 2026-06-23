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
                'id', 'shop_name', 'seller_id', 'shops_code',
                // A-E
                'order_id', 'transaction_type', 'order_create_time', 'order_paid_time', 'currency',
                // F-M
                'total_payment_amount', 'revenue_amount',
                'product_amount_after_seller_discount', 'product_amount_before_discount',
                'seller_discount', 'refund_after_seller_discount', 'refund_before_seller_discount',
                'refund_seller_discount',
                // N-P
                'total_fee', 'order_fee', 'tiktok_commission',
                // Q-Z
                'credit_card_installment', 'seller_shipping_cost', 'actual_shipping_fee',
                'platform_shipping_discount', 'customer_shipping_fee', 'return_shipping_fee',
                'shipping_refund', 'shipping_subsidy', 'exchange_shipping_fee', 'replacement_shipping_fee',
                // AA-AJ
                'affiliate_commission', 'non_affiliate_commission_before_pit', 'affiliate_commission_pit',
                'affiliate_partner_commission', 'affiliate_shop_ads_commission',
                'affiliate_shop_ads_commission_before_pit', 'affiliate_shop_ads_commission_pit',
                'affiliate_commission_deposit', 'affiliate_commission_refund',
                'affiliate_partner_shop_ads_commission',
                // AK-AX
                'sfp_service_fee', 'bonus_refund_service_fee', 'live_coupon_service_fee',
                'xtra_coupon_service_fee', 'eams_program_fee', 'flash_sale_service_fee',
                'paylater_fee', 'shop_growth_support_fee', 'infrastructure_fee',
                'campaign_resource_fee', 'preorder_fee',
                'gmv_max_coupon', 'gmv_max_coupon_sales_tax', 'gmv_max_ads_fee',
                // AZ-BJ
                'adjustment_amount', 'related_order_id',
                'customer_payment', 'customer_refund',
                'seller_joint_coupon', 'seller_joint_coupon_refund',
                'platform_discount', 'platform_discount_refund',
                'platform_joint_coupon', 'platform_joint_coupon_refund',
                'seller_shipping_discount',
                // BK-BW
                'estimated_parcel_weight', 'charged_weight', 'product_details', 'customer_bank',
                'statement_id', 'payment_id', 'payment_status', 'payment_time', 'statement_time',
                'net_sales_amount', 'fee_amount', 'settlement_amount', 'shipping_cost_amount',
                'file_id',
            ])
            ->orderByDesc('payment_time')
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('order_id', 'ilike', "%{$s}%")
                   ->orWhere('payment_id', 'ilike', "%{$s}%")
                   ->orWhere('statement_id', 'ilike', "%{$s}%")
                   ->orWhere('transaction_type', 'ilike', "%{$s}%")
                   ->orWhere('product_details', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('transaction_type')) {
            $q->where('transaction_type', 'ilike', '%' . $request->transaction_type . '%');
        }

        if ($request->filled('start_date')) {
            $q->where('payment_time', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('payment_time', '<=', $request->end_date . ' 23:59:59');
        }

        if ($request->filled('payment_status')) {
            $q->where('payment_status', 'ilike', $request->payment_status);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
