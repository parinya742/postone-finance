<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LazadaInvoiceController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')
            ->table('lazada_invoice_file as lif')
            ->leftJoin('lazada_transaction_tokens as ltt', 'ltt.short_code', '=', 'lif.seller_key')
            ->whereNull('lif.error_msg')
            ->select('lif.*', 'ltt.shop_name');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderByRaw("to_date(lif.invoice_date, 'DD Mon YYYY') desc");

        if ($request->filled('search')) {
            $search = $request->search;
            $q->where(function ($qb) use ($search) {
                $qb->where('lif.invoice_no', 'ilike', "%{$search}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('ltt.shop_name', $request->shop_name);
        }

        if ($request->filled('invoice_type')) {
            $q->where('lif.invoice_type', $request->invoice_type);
        }

        if ($request->filled('provider')) {
            $q->where('lif.provider', $request->provider);
        }

        if ($request->filled('start_date')) {
            $q->whereRaw("to_date(lif.invoice_date, 'DD Mon YYYY') >= ?", [$request->start_date]);
        }

        if ($request->filled('end_date')) {
            $q->whereRaw("to_date(lif.invoice_date, 'DD Mon YYYY') <= ?", [$request->end_date]);
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }
}
