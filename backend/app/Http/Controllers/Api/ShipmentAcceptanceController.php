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
            ->table('thailand_post_acceptance as thpa')
            ->select([
                'thpa.barcode',
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
                'pat.name as account_type_name',
                DB::raw("
                    CASE WHEN thpa.service_name ILIKE '%EMS%' THEN (
                        SELECT CEIL(er.rate + COALESCE(
                            (SELECT value FROM ems_settings WHERE key = 'offset' LIMIT 1), 0
                        ))
                        FROM ems_rates er
                        WHERE er.weight >= CEIL(
                            CASE WHEN thpa.weight_grams < 10 THEN thpa.weight_grams ELSE thpa.weight_grams / 1000.0 END
                        )
                        ORDER BY er.weight ASC
                        LIMIT 1
                    ) ELSE NULL END AS ems_calculated_cost
                "),
                DB::raw("
                    CASE WHEN thpa.service_name ILIKE '%จดหมาย%' THEN (
                        SELECT CEIL(dlr.rate + COALESCE(
                            (SELECT value FROM domestic_letter_settings WHERE key = 'offset' LIMIT 1), 0
                        ))
                        FROM domestic_letter_rates dlr
                        WHERE dlr.weight >= CEIL(
                            (CASE WHEN thpa.weight_grams < 10 THEN thpa.weight_grams ELSE thpa.weight_grams / 1000.0 END) * 100.0
                        ) / 100.0
                        ORDER BY dlr.weight ASC
                        LIMIT 1
                    ) ELSE NULL END AS dl_calculated_cost
                "),
            ])
            ->leftJoin('postone_shipments as ps', 'ps.tracking_no', '=', 'thpa.barcode')
            ->leftJoin('postone_account_types as pat', 'pat.id', '=', 'ps.account_type_id')
            ->leftJoin('line_group_files as lgf', 'lgf.id', '=', 'thpa.parent_file_id')
            ->where(function ($q) {
                $q->whereNull('thpa.parent_file_id')
                  ->orWhere('lgf.is_active', true);
            })
            ->orderByDesc('thpa.deposit_datetime');

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('thpa.barcode', 'ilike', "%{$s}%")
                  ->orWhere('thpa.tr_number', 'ilike', "%{$s}%")
                  ->orWhere('ps.label_id', 'ilike', "%{$s}%")
                  ->orWhere('ps.customer_name', 'ilike', "%{$s}%")
                  ->orWhere('ps.so_number', 'ilike', "%{$s}%")
                  ->orWhere('ps.pi_number', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('match_status')) {
            if ($request->match_status === 'matched') {
                $query->whereNotNull('ps.tracking_no');
            } elseif ($request->match_status === 'unmatched') {
                $query->whereNull('ps.tracking_no');
            }
        }

        if ($request->filled('date_from')) {
            $query->whereDate('thpa.deposit_datetime', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('thpa.deposit_datetime', '<=', $request->date_to);
        }

        if ($request->filled('service_type')) {
            $query->where('thpa.service_name', 'ilike', '%' . $request->service_type . '%');
        }

        if ($request->filled('account_type')) {
            $query->where('pat.name', $request->account_type);
        }

        return $query;
    }

    public function index(Request $request): JsonResponse
    {
        $baseStats = DB::connection('n8n')
            ->table('thailand_post_acceptance as thpa')
            ->leftJoin('postone_shipments as ps', 'ps.tracking_no', '=', 'thpa.barcode')
            ->leftJoin('line_group_files as lgf', 'lgf.id', '=', 'thpa.parent_file_id')
            ->where(function ($q) {
                $q->whereNull('thpa.parent_file_id')
                  ->orWhere('lgf.is_active', true);
            })
            ->selectRaw('COUNT(*) as total_all, COUNT(ps.tracking_no) as matched_all, SUM(CASE WHEN ps.tracking_no IS NULL THEN 1 ELSE 0 END) as unmatched_all')
            ->first();

        $paginated = $this->baseQuery($request)->paginate($request->integer('per_page', 20));

        return response()->json(array_merge(
            $paginated->toArray(),
            [
                'total_all'      => (int) $baseStats->total_all,
                'matched_count'  => (int) $baseStats->matched_all,
                'unmatched_count'=> (int) $baseStats->unmatched_all,
            ]
        ));
    }

    public function export(Request $request): JsonResponse
    {
        $items = $this->baseQuery($request)->limit(50000)->get();

        return response()->json($items);
    }
}
