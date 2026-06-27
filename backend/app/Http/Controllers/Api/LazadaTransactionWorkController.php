<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LazadaTransactionWorkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->select([
                'id', 'shop_name', 'transaction_date', 'transaction_type',
                'fee_name', 'transaction_number', 'details', 'seller_sku', 'lazada_sku',
                'amount', 'vat_in_amount', 'wht_amount', 'wht_included_in_amount',
                'statement', 'paid_status', 'order_no', 'order_item_no', 'order_item_status',
                'shipping_provider', 'shipping_speed', 'shipment_type',
                'reference', 'comment', 'payment_ref_id', 'short_code', 'source', 'synced_at', 'file_id',
            ])
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('transaction_number', 'ilike', "%{$s}%")
                   ->orWhere('order_no', 'ilike', "%{$s}%")
                   ->orWhere('fee_name', 'ilike', "%{$s}%")
                   ->orWhere('details', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('transaction_type')) {
            $q->where('transaction_type', 'ilike', '%' . $request->transaction_type . '%');
        }

        if ($request->filled('start_date')) {
            $q->where('transaction_date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('transaction_date', '<=', $request->end_date);
        }

        if ($request->filled('paid_status')) {
            $q->where('paid_status', 'ilike', $request->paid_status);
        }

        if ($request->filled('source')) {
            $q->where('source', $request->source);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
