<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LineSoController extends Controller
{
    private const CUSTID_AREA_MAP = [
        'f680000004' => 'Claim & Customer Service',
        '777-7015s'  => 'Product Special list',
        '777-7010s'  => 'ONL เบิกสินค้าตัวอย่าง',
        '888-7010s'  => 'ONL เคลมสินค้า',
        '777-7014s'  => 'MKT',
        '777-7008s'  => 'MKT เบิกสินค้าตัวอย่าง',
        '777-7003s'  => 'CEO เบิกสินค้าตัวอย่าง',
    ];

    private const PREFIX_AREA_MAP = [
        '70' => 'TT BKK', 
        '80' => 'TT UPC', 
        '20' => 'MT',
        '70010' => 'YP',
        '70370' => 'YP',
    ];

    public function index(Request $request): JsonResponse
    {
        $paginated = $this->buildQuery($request)->paginate($request->integer('per_page', 15));

        $merged = $this->mergeSoHeadData($paginated->items());

        $response = $paginated->toArray();
        $response['data'] = $merged;

        return response()->json($response);
    }

    public function export(Request $request): JsonResponse
    {
        $items = $this->buildQuery($request)->limit(50000)->get();

        $merged = $this->mergeSoHeadData($items);

        return response()->json($merged);
    }

    private function buildQuery(Request $request)
    {
        $s = $request->filled('search') ? $request->search : null;

        // Step 1: If search, pre-fetch matching PINo list from ISCODE
        $matchedPiNos = collect();
        if ($s) {
            $matchedPiNos = DB::connection('dbctl')
                ->table('ct_so_head')
                ->where('pino', 'ilike', "%{$s}%")
                ->orWhere('custname', 'ilike', "%{$s}%")
                ->orWhere('sono', 'ilike', "%{$s}%")
                ->orWhere('pono', 'ilike', "%{$s}%")
                ->pluck('pino');
        }

        // Step 2: Query from n8n (LINE + Postone + Special Zone rate)
        $query = DB::connection('n8n')
            ->table('thailand_post_acceptance as thpa')
            ->select([
                'thpa.barcode',
                'thpa.deposit_datetime',
                'thpa.destination_code',
                'thpa.destination_name',
                'thpa.weight_grams',
                'thpa.service_name',
                'thpa.service_fee',
                'ps.pi_number',
                'ps.customer_name',
                'ps.product_details',
                'spz.rate as special_zone_rate',
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
            ->leftJoin('special_postal_zones as spz', 'spz.office_name', '=', 'thpa.destination_name')
            ->leftJoin('postone_account_types as pat', 'pat.id', '=', 'ps.account_type_id')
            ->orderByDesc('thpa.deposit_datetime');

        if ($s) {
            $query->where(function ($q) use ($s, $matchedPiNos) {
                $q->where('thpa.barcode', 'ilike', "%{$s}%");
                if ($matchedPiNos->isNotEmpty()) {
                    $q->orWhereIn('ps.pi_number', $matchedPiNos);
                }
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('thpa.deposit_datetime', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('thpa.deposit_datetime', '<=', $request->date_to);
        }

        if ($request->boolean('no_pi_number')) {
            $query->whereNull('ps.pi_number');
        }

        if ($request->filled('service_type')) {
            $query->where('thpa.service_name', 'ilike', '%' . $request->service_type . '%');
        }

        if ($request->boolean('no_iscode') || $request->filled('area')) {
            $activePiNos = $query->clone()
                ->whereNotNull('ps.pi_number')
                ->pluck('ps.pi_number')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $existingIscodePiNos = [];
            if (!empty($activePiNos)) {
                $existingIscodePiNos = DB::connection('dbctl')
                    ->table('ct_so_head')
                    ->whereIn('pino', $activePiNos)
                    ->pluck('pino')
                    ->unique()
                    ->all();
            }

            if ($request->boolean('no_iscode')) {
                $query->where(function ($q) use ($existingIscodePiNos) {
                    $q->whereNull('ps.pi_number');
                    if (!empty($existingIscodePiNos)) {
                        $q->orWhereNotIn('ps.pi_number', $existingIscodePiNos);
                    }
                });
            }

            if ($request->filled('area')) {
                $this->applyAreaFilterOptimized($query, trim($request->area), $activePiNos, $existingIscodePiNos);
            }
        }

        return $query;
    }

    private function applyAreaFilterOptimized($query, string $area, array $activePiNos, array $existingIscodePiNos): void
    {
        $custidAreaMap  = array_flip(self::CUSTID_AREA_MAP); // area → custid
        $prefixAreaMap  = array_flip(self::PREFIX_AREA_MAP); // area → prefix
        $specialCustIds = array_map('strtolower', array_keys(self::CUSTID_AREA_MAP));

        $filteredPiNos = [];
        $isIscodeArea = isset($custidAreaMap[$area]) || isset($prefixAreaMap[$area]);

        if ($isIscodeArea && !empty($activePiNos)) {
            $dbctlQuery = DB::connection('dbctl')
                ->table('ct_so_head')
                ->whereIn('pino', $activePiNos);

            if ($area === 'Aftersale service') {
                $dbctlQuery->where(function ($q) {
                    $q->whereRaw("lower(trim(custid)) = '9980-0'")
                      ->orWhereRaw("trim(fieldsaleid) = '9980-0'");
                });

            } elseif (isset($custidAreaMap[$area])) {
                $custid = strtolower($custidAreaMap[$area]);
                $dbctlQuery->whereRaw('lower(trim(custid)) = ?', [$custid]);

            } elseif (isset($prefixAreaMap[$area])) {
                $prefixes = array_keys(array_filter(self::PREFIX_AREA_MAP, fn($a) => $a === $area));
                $dbctlQuery->where(function ($q) use ($specialCustIds) {
                        $q->whereNotIn(DB::raw('lower(trim(custid))'), $specialCustIds)
                          ->orWhereNull('custid');
                    })
                    ->where(function ($q) {
                        $q->whereRaw("trim(fieldsaleid) != '9980-0'")
                          ->orWhereNull('fieldsaleid');
                    })
                    ->where(function ($q) use ($prefixes) {
                        foreach ($prefixes as $prefix) {
                            $q->orWhere(function ($inner) use ($prefix) {
                                $inner->where(function ($p) use ($prefix) {
                                    $p->whereNotNull('sono')
                                      ->where('sono', '!=', '')
                                      ->where('sono', 'ilike', "{$prefix}%");
                                })->orWhere(function ($p) use ($prefix) {
                                    $p->where(function ($s) {
                                        $s->whereNull('sono')->orWhere('sono', '');
                                    })->where('pino', 'ilike', "{$prefix}%");
                                });
                            });
                        }
                    });
            }

            $filteredPiNos = $dbctlQuery->pluck('pino')->filter()->unique()->all();
        }

        $query->where(function ($q) use ($filteredPiNos, $existingIscodePiNos, $area, $isIscodeArea) {
            if ($isIscodeArea) {
                $q->whereIn('ps.pi_number', $filteredPiNos);
            } else {
                $q->where('pat.name', $area)
                    ->where(function ($s) use ($existingIscodePiNos) {
                        $s->whereNull('ps.pi_number');
                        if (!empty($existingIscodePiNos)) {
                            $s->orWhereNotIn('ps.pi_number', $existingIscodePiNos);
                        }
                    });
            }
        });
    }

    private function mergeSoHeadData($items)
    {
        // Step 3: Fetch ISCODE SO_Head for the given items' pi_numbers
        $piNos = collect($items)
            ->pluck('pi_number')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $soHeadMap = collect();
        if (!empty($piNos)) {
            $soHeadMap = DB::connection('dbctl')
                ->table('ct_so_head')
                ->select(['sodate', 'sono', 'pino', 'dino', 'pono', 'custid', 'custname', 'numofitem', 'fieldsaleid', 'fieldsalename', 'createby', 'createbyname', 'docremark', 'accremark'])
                ->whereIn('pino', $piNos)
                ->get()
                ->keyBy('pino');
        }

        // Step 4: Merge ISCODE data into each row
        return collect($items)->map(function ($item) use ($soHeadMap) {
            $so = $soHeadMap->get($item->pi_number);

            $area = null;
            if (!$so) {
                $area = $item->account_type_name;
            } else {
                $custidLower = strtolower(trim($so->custid ?? ''));
                $fieldsaleid = trim($so->fieldsaleid ?? '');
                $sono = trim($so->sono ?? '');
                $pino = trim($so->pino ?? '');

                if (isset(self::CUSTID_AREA_MAP[$custidLower])) {
                    $area = self::CUSTID_AREA_MAP[$custidLower];
                } elseif ($fieldsaleid === '9980-0') {
                    $area = 'Aftersale service';
                } else {
                    $billingCode = $sono ?: $pino;
                    if ($billingCode !== '') {
                        $prefixMap = self::PREFIX_AREA_MAP;
                        uksort($prefixMap, fn($a, $b) => strlen($b) - strlen($a));
                        foreach ($prefixMap as $prefix => $areaName) {
                            if (str_starts_with($billingCode, $prefix)) {
                                $area = $areaName;
                                break;
                            }
                        }
                    }
                }
            }

            return array_merge((array) $item, [
                'SODate'        => $so?->sodate,
                'SoNo'          => $so?->sono,
                'PINo'          => $so?->pino,
                'DINo'          => $so?->dino,
                'PONo'          => $so?->pono,
                'CustID'        => $so?->custid,
                'CustName'      => $so?->custname,
                'NumOfItem'     => $so?->numofitem,
                'FieldSaleID'   => $so?->fieldsaleid,
                'FieldSaleName' => $so?->fieldsalename,
                'CreateBy'      => $so?->createby,
                'CreateByName'  => $so?->createbyname,
                'DocRemark'     => $so?->docremark,
                'ACCRemark'     => $so?->accremark,
                'Area'          => $area,
            ]);
        });
    }
}
