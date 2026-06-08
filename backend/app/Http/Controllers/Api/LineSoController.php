<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\AuditLog;

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

    public function summary(Request $request): JsonResponse
    {
        $sub = $this->buildQuery($request);

        $result = DB::connection('n8n')
            ->table(DB::raw("({$sub->toSql()}) as sub"))
            ->mergeBindings($sub)
            ->selectRaw("
                SUM(weight_grams) as weight_grams,
                SUM(service_fee) as service_fee,
                SUM(special_zone_rate) as special_zone_rate,
                SUM(COALESCE(dl_calculated_cost, ems_calculated_cost, service_fee)) as transport,
                SUM(
                    CASE
                        WHEN dl_calculated_cost IS NOT NULL THEN
                            CEIL(ROUND(
                                CASE WHEN weight_grams < 10 THEN weight_grams ELSE weight_grams / 1000.0 END * 10000
                            ) / 100.0) / 100.0
                        WHEN ems_calculated_cost IS NOT NULL THEN
                            CEIL(CASE WHEN weight_grams < 10 THEN weight_grams ELSE weight_grams / 1000.0 END)
                        ELSE
                            CASE WHEN weight_grams < 10 THEN weight_grams ELSE weight_grams / 1000.0 END
                    END
                ) as weight_kg,
                COUNT(*) as total_count
            ")
            ->first();

        $transport   = (float) ($result->transport ?? 0);
        $serviceFee  = (float) ($result->service_fee ?? 0);

        return response()->json([
            'weight_grams'      => (float) ($result->weight_grams ?? 0),
            'service_fee'       => $serviceFee,
            'special_zone_rate' => (float) ($result->special_zone_rate ?? 0),
            'transport'         => $transport,
            'weight_kg'         => (float) ($result->weight_kg ?? 0),
            'diff'              => $transport - $serviceFee,
            'total_count'       => (int) ($result->total_count ?? 0),
        ]);
    }

    public function export(Request $request): JsonResponse
    {
        $items = $this->buildQuery($request)->limit(50000)->get();

        $merged = $this->mergeSoHeadData($items);

        AuditLog::record(
            'export',
            'line_so_report',
            0,
            'Line SO Report',
            [
                'search' => $request->query('search'),
                'date_from' => $request->query('date_from'),
                'date_to' => $request->query('date_to'),
                'no_pi_number' => $request->boolean('no_pi_number'),
                'area' => $request->query('area'),
                'service_type' => $request->query('service_type'),
                'record_count' => count($merged),
            ]
        );

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
                'ps.so_number',
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
                $q->where('thpa.barcode', 'ilike', "%{$s}%")
                  ->orWhere('ps.so_number', 'ilike', "%{$s}%");
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
            // หา so_number ของ record ที่ไม่มี pi_number แล้วเช็คว่ามีใน ISCODE ผ่าน sono หรือเปล่า
            $noPiSoNos = $query->clone()
                ->whereNull('ps.pi_number')
                ->whereNotNull('ps.so_number')
                ->pluck('ps.so_number')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $soNosInIscode = [];
            if (!empty($noPiSoNos)) {
                $soNosInIscode = DB::connection('dbctl')
                    ->table('ct_so_head')
                    ->whereIn('sono', $noPiSoNos)
                    ->pluck('sono')
                    ->unique()
                    ->all();
            }

            // ไม่พบ = ไม่มี pi_number AND (so_number เป็น null หรือไม่ตรงกับ sono ใน ISCODE)
            $query->whereNull('ps.pi_number');
            if (!empty($soNosInIscode)) {
                $query->where(function ($q) use ($soNosInIscode) {
                    $q->whereNull('ps.so_number')
                      ->orWhereNotIn('ps.so_number', $soNosInIscode);
                });
            }
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
        $isIscodeArea = isset($custidAreaMap[$area]) || isset($prefixAreaMap[$area]) || $area === 'Aftersale service';

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
        $selectCols = ['sodate', 'sono', 'pino', 'dino', 'pono', 'custid', 'custname', 'numofitem', 'fieldsaleid', 'fieldsalename', 'createby', 'createbyname', 'docremark', 'accremark'];

        // Step 3a: Fetch by pi_number → pino (split comma-separated values)
        $piNos = collect($items)
            ->pluck('pi_number')
            ->filter()
            ->flatMap(fn($p) => array_map('trim', explode(',', $p)))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $soHeadByPino = collect();
        if (!empty($piNos)) {
            $soHeadByPino = DB::connection('dbctl')
                ->table('ct_so_head')
                ->select($selectCols)
                ->whereIn('pino', $piNos)
                ->get()
                ->keyBy('pino');
        }

        // Step 3b: Fetch by so_number → sono (fallback for records without pi_number match)
        $soNos = collect($items)->pluck('so_number')->filter()->unique()->values()->all();

        $soHeadBySono = collect();
        if (!empty($soNos)) {
            $soHeadBySono = DB::connection('dbctl')
                ->table('ct_so_head')
                ->select($selectCols)
                ->whereIn('sono', $soNos)
                ->get()
                ->keyBy('sono');
        }

        // Step 4: Merge ISCODE data into each row
        return collect($items)->map(function ($item) use ($soHeadByPino, $soHeadBySono) {
            // pi_number อาจเป็น comma-separated → ลอง match ทีละตัว
            $piList = collect(explode(',', $item->pi_number ?? ''))
                ->map(fn($p) => trim($p))
                ->filter();

            $so = $piList->map(fn($p) => $soHeadByPino->get($p))->filter()->first()
               ?? $soHeadBySono->get($item->so_number);

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
