<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LineSoController extends Controller
{
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
        $items = $this->buildQuery($request)->get();

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

        if ($request->boolean('no_iscode')) {
            // Records with no pi_number (no Postone match) are always missing ISCODE data.
            // Records with a pi_number but not found in ct_so_head are also missing.
            $iscodePinos = DB::connection('dbctl')
                ->table('ct_so_head')
                ->whereNotNull('pino')
                ->where('pino', '!=', '')
                ->pluck('pino')
                ->unique()
                ->values()
                ->all();

            $query->where(function ($q) use ($iscodePinos) {
                $q->whereNull('ps.pi_number');
                if (!empty($iscodePinos)) {
                    $q->orWhereNotIn('ps.pi_number', $iscodePinos);
                }
            });
        }

        return $query;
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

                if ($custidLower === 'f680000004') {
                    $area = 'เคลมสินค้า Customer Service';
                } elseif ($custidLower === '777-7015s') {
                    $area = 'PRODUCT SPECIALIST';
                } elseif ($custidLower === '777-7010s') {
                    $area = 'แผนกการตลาดออนไลน์เบิกสินค้าตัวอย่าง';
                } elseif ($custidLower === '888-7010s') {
                    $area = 'แผนกการตลาดออนไลน์(เคลมสินค้า)';
                } elseif ($custidLower === '777-7014s') {
                    $area = 'แผนกการตลาด Branding Media';
                } elseif ($custidLower === '777-7008s') {
                    $area = 'แผนกการตลาดเบิกสินค้าตัวอย่าง';
                } elseif ($custidLower === '777-7003s') {
                    $area = 'ผู้บริหารเบิกสินค้า';
                } elseif ($fieldsaleid === '9980-0') {
                    $area = 'ช่าง';
                } else {
                    $billingCode = $sono ?: $pino;
                    if ($billingCode !== '') {
                        $firstChar = $billingCode[0];
                        if ($firstChar === '7') {
                            $area = 'BKK';
                        } elseif ($firstChar === '8') {
                            $area = 'UPC';
                        } elseif ($firstChar === '2') {
                            $area = 'MT';
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
