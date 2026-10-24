<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TikTokOrderController extends Controller
{
    /** One shop name per shops_code (tokens table may hold several rows per shop). */
    private function shopNames()
    {
        return DB::connection('n8n')
            ->table('tiktok_transaction_tokens')
            ->selectRaw('DISTINCT ON (shops_code) shops_code, seller_name')
            ->whereNotNull('shops_code')
            ->orderBy('shops_code')
            ->orderByDesc('updated_at');
    }

    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('tiktok_order_line as l')
            ->leftJoinSub($this->shopNames(), 's', 's.shops_code', '=', 'l.shop_code')
            ->select([
                'l.id', 'l.file_id', 'l.shop_code', 's.seller_name as shop_name',
                'l.order_id', 'l.sku_id', 'l.line_seq',
                'l.order_status', 'l.order_substatus', 'l.cancel_return_type',
                'l.seller_sku', 'l.product_name', 'l.variation',
                'l.quantity', 'l.return_quantity',
                'l.unit_original_price', 'l.subtotal_before_discount',
                'l.platform_discount', 'l.seller_discount', 'l.subtotal_after_discount',
                'l.shipping_fee_after_discount', 'l.original_shipping_fee',
                'l.shipping_fee_seller_discount', 'l.shipping_fee_platform_discount',
                'l.payment_platform_discount', 'l.taxes',
                'l.order_amount', 'l.order_refund_amount',
                'l.created_time', 'l.paid_time', 'l.rts_time', 'l.shipped_time',
                'l.delivered_time', 'l.cancelled_time', 'l.cancel_by', 'l.cancel_reason',
                'l.fulfillment_type', 'l.warehouse_name', 'l.tracking_id',
                'l.delivery_option', 'l.shipping_provider', 'l.payment_method',
                'l.product_category', 'l.package_id', 'l.order_channel', 'l.creator_handle',
                'l.updated_at',
            ])
            ->orderByDesc('l.created_time')
            ->orderBy('l.order_id')
            ->orderBy('l.line_seq');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('l.order_id', 'ilike', "%{$s}%")
                   ->orWhere('l.seller_sku', 'ilike', "%{$s}%")
                   ->orWhere('l.product_name', 'ilike', "%{$s}%")
                   ->orWhere('l.tracking_id', 'ilike', "%{$s}%")
                   ->orWhere('l.creator_handle', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_code')) {
            $q->where('l.shop_code', $request->shop_code);
        }

        if ($request->filled('order_status')) {
            $q->where('l.order_status', $request->order_status);
        }

        if ($request->filled('file_id')) {
            $q->where('l.file_id', $request->integer('file_id'));
        }

        if ($request->filled('start_date')) {
            $q->where('l.created_time', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('l.created_time', '<=', $request->end_date . ' 23:59:59');
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }

    public function statuses(): JsonResponse
    {
        $statuses = DB::connection('n8n')
            ->table('tiktok_order_line')
            ->whereNotNull('order_status')
            ->distinct()
            ->orderBy('order_status')
            ->pluck('order_status');

        return response()->json($statuses);
    }

    public function files(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('tiktok_order_export_file as f')
            ->leftJoinSub($this->shopNames(), 's', 's.shops_code', '=', 'f.shop_code')
            ->select('f.*', 's.seller_name as shop_name')
            ->orderByDesc('f.range_to')
            ->orderByDesc('f.created_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('f.file_name', 'ilike', "%{$s}%")
                   ->orWhere('f.shop_code', 'ilike', "%{$s}%")
                   ->orWhere('s.seller_name', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_code')) {
            $q->where('f.shop_code', $request->shop_code);
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }
}
