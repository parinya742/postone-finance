<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopeeOrderItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('shopee_order_items')
            ->select([
                'order_sn', 'order_status', 'create_time', 'pay_time',
                'ship_by_date', 'complete_time', 'update_time',
                'shop_id', 'shop_name',
                'buyer_username', 'buyer_user_id',
                'payment_method', 'shipping_option', 'tracking_no',
                'item_id', 'parent_sku', 'item_name', 'sku_ref', 'variation_name',
                'original_price', 'selling_price', 'qty', 'qty_returned', 'qty_cancelled',
                'net_price', 'shopee_discount', 'seller_voucher', 'commission_fee',
                'transaction_fee', 'service_fee', 'total_amount',
                'buyer_paid_price', 'buyer_shipping_fee',
                'province', 'district', 'cancel_reason', 'return_status',
                'range_from', 'range_to', 'updated_at',
            ])
            ->orderByDesc('create_time');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('order_sn', 'ilike', "%{$s}%")
                   ->orWhere('buyer_username', 'ilike', "%{$s}%")
                   ->orWhere('item_name', 'ilike', "%{$s}%")
                   ->orWhere('sku_ref', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('order_status')) {
            $q->where('order_status', $request->order_status);
        }

        if ($request->filled('start_date')) {
            $q->where('create_time', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('create_time', '<=', $request->end_date . ' 23:59:59');
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
