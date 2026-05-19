<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShipmentAcceptanceController extends Controller
{
    private function baseQuery(Request $request)
    {
        $query = DB::connection('n8n')
            ->table('postone_shipments as ps')
            ->select([
                'ps.label_id',
                'ps.customer_name',
                'ps.product_details',
                'ps.pi_number',
                'ps.so_number',
                DB::raw('ps.cod_amount as ps_cod_amount'),
                'ps.shipping_by',
                'ps.shipping_cost',
                'ps.tracking_no',
                'ps.due_date',
                'ps.latest_status',
                'thpa.office_code',
                'thpa.office_name',
                'thpa.print_datetime',
                'thpa.tr_number',
                'thpa.deposit_datetime',
                'thpa.recipient_name',
                'thpa.destination',
                'thpa.destination_code',
                'thpa.destination_name',
                'thpa.weight_grams',
                'thpa.recipient_phone',
                'thpa.service_name',
                'thpa.service_fee',
                DB::raw('thpa.cod_amount as thpa_cod_amount'),
                'thpa.wallet_phone',
                'thpa.sender_name',
            ])
            ->leftJoin('thailand_post_acceptance as thpa', 'thpa.barcode', '=', 'ps.tracking_no')
            ->orderByDesc('ps.due_date');

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('ps.label_id', 'ilike', "%{$s}%")
                  ->orWhere('ps.customer_name', 'ilike', "%{$s}%")
                  ->orWhere('ps.tracking_no', 'ilike', "%{$s}%")
                  ->orWhere('ps.so_number', 'ilike', "%{$s}%")
                  ->orWhere('ps.pi_number', 'ilike', "%{$s}%")
                  ->orWhere('thpa.tr_number', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('match_status')) {
            if ($request->match_status === 'matched') {
                $query->whereNotNull('thpa.barcode');
            } elseif ($request->match_status === 'unmatched') {
                $query->whereNull('thpa.barcode');
            }
        }

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        $unmatchedCount = DB::connection('n8n')
            ->table('postone_shipments as ps')
            ->leftJoin('thailand_post_acceptance as thpa', 'thpa.barcode', '=', 'ps.tracking_no')
            ->whereNull('thpa.barcode')
            ->count();

        $paginated = $this->baseQuery($request)->paginate($request->integer('per_page', 20));

        return response()->json(array_merge(
            $paginated->toArray(),
            ['unmatched_count' => $unmatchedCount]
        ));
    }

    public function export(Request $request): JsonResponse
    {
        $items = $this->baseQuery($request)->get();

        return response()->json($items);
    }
}
