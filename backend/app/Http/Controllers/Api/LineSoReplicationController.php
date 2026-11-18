<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\AuditLog;

/**
 * Line SO Report — same logic as LineSoController, but ISCODE data comes from the
 * "replication" connection (SO_Head / SH_Head / PI_Head / OO_Head / IO_Head)
 * instead of dbctl.ct_so_head. See soHead() for the column mapping.
 */
class LineSoReplicationController extends Controller
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
        '70' => 'BKK', 
        '80' => 'UPC', 
        '20' => 'MT',
        '70010' => 'YP',
        '70370' => 'YP',
        '70379' => 'YP',
    ];

    // A PI comes from exactly one source document: PISO → SH → SO, PIOO → OO, PIIO → IO.
    // Each field is taken from whichever of SO / OO / IO the PI belongs to.
    private const SO_HEAD_SQL = <<<'SQL'
        SELECT
            CASE
                WHEN so."SONo" IS NOT NULL THEN 'SO'
                WHEN oo."OONo" IS NOT NULL THEN 'OO'
                ELSE 'IO'
            END                                                        AS sourcetype,
            COALESCE(so."SODate",       oo."OODate",       io."IODate")       AS sodate,
            COALESCE(so."SONo",         oo."OONo",         io."IONo")         AS sono,
            pi."PINo"                                                         AS pino,
            COALESCE(sh."DINo",         oo."DINo")                            AS dino,
            sh."SINo"                                                         AS sino,
            sh."SHNo"                                                         AS shno,
            COALESCE(so."RefPONo",      oo."OnlineDocNo",  io."RefPONo")      AS pono,
            COALESCE(so."CustId",       oo."CustId",       io."CustId")       AS custid,
            COALESCE(so."CustName",     oo."CustName",     io."CustName")     AS custname,
            COALESCE(so."CountItem",    oo."CountItem",    io."CountItem")    AS numofitem,
            COALESCE(so."SaleReptId",   oo."SaleReptId",   io."SaleReptId")   AS fieldsaleid,
            COALESCE(so."SaleReptName", oo."SaleReptName", io."SaleReptName") AS fieldsalename,
            COALESCE(so."CreateBy",     oo."CreateBy",     io."CreateBy")     AS createby,
            COALESCE(so."CreateByName", oo."CreateByName", io."CreateByName") AS createbyname,
            COALESCE(so."SORemark",     oo."OORemark",     io."IORemark")     AS docremark,
            COALESCE(so."ACCRemark",    io."ACCRemark")                       AS accremark
        FROM "PI_Head" pi
        LEFT JOIN "SH_Head" sh ON pi."FromDocNo" = sh."SHNo"
        LEFT JOIN "SO_Head" so ON sh."AllSONo" = so."SONo"
        LEFT JOIN "OO_Head" oo ON pi."FromDocNo" = oo."OONo"
        LEFT JOIN "IO_Head" io ON pi."FromDocNo" = io."IONo"
        WHERE so."SONo" IS NOT NULL OR oo."OONo" IS NOT NULL OR io."IONo" IS NOT NULL
        SQL;

    // First document number written in product_details, used when pi/fi are empty
    // (e.g. "PIIO-261100519", "SI-261100292 สินค้า 6 รายการ", "SH-261055826 / Line").
    // so_number is ignored here: it is sometimes derived wrongly from a PI ("PISO-261101337" → "SO-261101337").
    // "PPIO-" is a common typo of "PIIO-". Outer group = whole match.
    private const PDOC_SQL = <<<'SQL'
        CASE WHEN ps.pi_number IS NULL AND ps.fi_number IS NULL
             THEN regexp_replace(
                    substring(upper(ps.product_details) from '\m((PISO|PIOO|PIIO|PPIO|DI|SI|SH|SO|OO|IO)-[0-9]+)'),
                    '^PPIO-', 'PIIO-')
        END
        SQL;

    // Effective PI / DI: the shipment's own column, else the PINo / DINo resolved from product_details (pd join)
    private const EFF_PI = 'COALESCE(ps.pi_number, pd.pino)';
    private const EFF_DI = 'COALESCE(ps.di_number, pd.dino)';

    private static function effPi()
    {
        return DB::raw(self::EFF_PI);
    }

    private static function effDi()
    {
        return DB::raw(self::EFF_DI);
    }

    /**
     * Resolve every document number found in product_details (rows with empty pi/fi/so/di)
     * to [doc, pino, dino] via ISCODE. PI / DI numbers map to themselves even when not in ISCODE,
     * so the "ไม่พบ PI No" filter still treats them as unmatched.
     */
    private function productDetailDocMap(): array
    {
        $docs = DB::connection('n8n')
            ->table('postone_shipments as ps')
            ->selectRaw('DISTINCT ' . self::PDOC_SQL . ' as doc')
            ->whereNull('ps.pi_number')->whereNull('ps.fi_number')
            ->whereNotNull('ps.product_details')
            ->pluck('doc')
            ->filter()
            ->values();

        $map = [];
        $lookup = [];
        foreach ($docs as $doc) {
            if (str_starts_with($doc, 'PI')) {
                $map[$doc] = [$doc, $doc, null];
            } elseif (str_starts_with($doc, 'DI-')) {
                $map[$doc] = [$doc, null, $doc];
            } else {
                $lookup[] = $doc; // SO / OO / IO / SI / SH
            }
        }

        if ($lookup) {
            $rows = $this->soHead()
                ->where(fn ($q) => $q->whereIn('sono', $lookup)->orWhereIn('sino', $lookup)->orWhereIn('shno', $lookup))
                ->get(['sono', 'sino', 'shno', 'pino', 'dino']);
            foreach ($rows as $row) {
                foreach ([$row->sono, $row->sino, $row->shno] as $doc) {
                    if ($doc && in_array($doc, $lookup, true) && !isset($map[$doc])) {
                        $map[$doc] = [$doc, $row->pino, $row->dino];
                    }
                }
            }
        }

        return array_values($map);
    }

    // Every document number a shipment row carries, as text[] — same set as rowKeys():
    // pi / fi / so / di (pi, fi may be comma-separated) + every doc number in product_details (PPIO- → PIIO-)
    private const ROW_KEYS_SQL = <<<'SQL'
        (string_to_array(regexp_replace(concat_ws(',', ps.pi_number, ps.fi_number, ps.so_number, ps.di_number), '\s+', '', 'g'), ',')
         || ARRAY(SELECT regexp_replace(upper(x[1]), '^PPIO-', 'PIIO-')
                  FROM regexp_matches(COALESCE(ps.product_details, ''), '\m((PISO|PIOO|PIIO|PPIO|PI|FI|DI|SI|SH|SO|OO|IO)-[0-9]+)', 'gi') AS x))
        SQL;

    private const DOC_NO_REGEX = '/\b(?:PI(?:SO|OO|IO)?|PPIO|FI|DI|SI|SH|SO|OO|IO)-\d+/i';

    /** All document numbers of one shipment row (same set as KEYS_SQL, plus every doc in product_details). */
    private function rowKeys($item): array
    {
        $keys = [];
        foreach (['pi_number', 'fi_number', 'so_number', 'di_number'] as $col) {
            foreach (explode(',', $item->$col ?? '') as $v) {
                $keys[] = trim($v);
            }
        }
        preg_match_all(self::DOC_NO_REGEX, $item->product_details ?? '', $m);
        foreach ($m[0] as $n) {
            $keys[] = preg_replace('/^PPIO-/', 'PIIO-', strtoupper($n));
        }
        return array_values(array_unique(array_filter($keys)));
    }

    private static function pgArray(array $values): string
    {
        return '{' . implode(',', array_map(
            fn ($s) => '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"', $values
        )) . '}';
    }

    /** Old base (dbctl.ct_so_head) rows whose pino / dino / sono is one of $keys, keyed by that number. */
    private function oldBaseByKey(array $keys, array $selectCols)
    {
        $map = collect();
        if (!$keys) {
            return $map;
        }
        $rows = $this->oldBaseRows($keys, $selectCols);
        foreach (['pino', 'dino', 'sono'] as $col) {
            foreach ($rows as $row) {
                if ($row->$col && !$map->has($row->$col)) {
                    $map->put($row->$col, $row);
                }
            }
        }
        $missing = array_values(array_filter($keys, fn ($k) => !$map->has($k)));
        foreach ($this->oldBaseTruncatedMatches($missing, $selectCols) as $key => $row) {
            $map->put($key, $row);
        }
        return $map;
    }

    // Number keyed in one digit short (8 digits instead of 9), e.g. "PI-26091719" for PI-260917194
    private const TRUNCATED_KEY_REGEX = '/^(PI|SO|DI|FI)-\d{8}$/';
    // ct_so_head.tranid of "ไปรษณีย์ไทย (EMS)" — narrows a truncated number to the postal shipment
    private const POSTAL_TRAN_ID = 'T2602001';

    /**
     * Truncated keys → the single old-base postal document whose number starts with that key.
     * Keys with 0 or several candidates are left unmatched (a guess would be worse than "ไม่พบ").
     */
    private function oldBaseTruncatedMatches(array $keys, array $selectCols): array
    {
        $byCol = [];
        foreach ($keys as $k) {
            if (preg_match(self::TRUNCATED_KEY_REGEX, $k, $m)) {
                $col = match ($m[1]) { 'PI' => 'pino', 'SO' => 'sono', default => 'dino' };
                $byCol[$col][] = $k;
            }
        }

        $result = [];
        foreach ($byCol as $col => $colKeys) {
            $rows = DB::connection('dbctl')->table('ct_so_head')
                ->select(array_unique(array_merge($selectCols, [$col])))
                ->where('tranid', self::POSTAL_TRAN_ID)
                ->whereRaw("{$col} LIKE ANY(?::text[])", [self::pgArray(array_map(fn ($k) => $k . '_', $colKeys))])
                ->get();
            foreach ($colKeys as $k) {
                $candidates = $rows->filter(fn ($r) => str_starts_with((string) $r->$col, $k));
                if ($candidates->count() === 1) {
                    $result[$k] = $candidates->first();
                }
            }
        }
        return $result;
    }

    /**
     * ct_so_head (936k rows, only sono indexed) rows whose pino / dino / sono is in $keys.
     * One query per column with IN (SELECT unnest(...)) → hash semi-join; an OR of = ANY(big array) was ~30s.
     */
    private function oldBaseRows(array $keys, array $selectCols)
    {
        $arr = self::pgArray($keys);
        $rows = collect();
        foreach (['sono', 'pino', 'dino'] as $col) {
            $rows = $rows->concat(
                DB::connection('dbctl')->table('ct_so_head')
                    ->select($selectCols)
                    ->whereRaw("{$col} IN (SELECT unnest(?::text[]))", [$arr])
                    ->get()
            );
        }
        return $rows->unique('sono')->values();
    }

    /** Subset of $keys that exist in the given base, checking the given columns. */
    private function existingKeys($baseQuery, array $keys, array $cols): array
    {
        if (!$keys) {
            return [];
        }
        $arr = self::pgArray($keys);
        $where = implode(' OR ', array_map(fn ($c) => "{$c} = ANY(?::text[])", $cols));
        $rows = $baseQuery->whereRaw("({$where})", array_fill(0, count($cols), $arr))->get($cols);
        $keySet = array_flip($keys);
        $found = [];
        foreach ($rows as $row) {
            foreach ($cols as $c) {
                if ($row->$c !== null && isset($keySet[$row->$c])) {
                    $found[$row->$c] = true;
                }
            }
        }
        return array_keys($found);
    }

    /**
     * Filter by where the row's documents are found: replication | old | none.
     * Uses the same document numbers as rowKeys() so the filter agrees with the "แหล่งที่พบ" column.
     */
    private function applyMatchSourceFilter($query, string $source): void
    {
        $keys = $query->clone()->reorder()
            ->select(['ps.pi_number', 'ps.fi_number', 'ps.so_number', 'ps.di_number', 'ps.product_details'])
            ->get()
            ->flatMap(fn ($r) => $this->rowKeys($r))
            ->unique()->values()->all();

        $repKeys = $this->existingKeys($this->soHead(), $keys, ['pino', 'dino', 'sono', 'sino', 'shno']);
        $oldKeys = [];
        if ($source !== 'replication') {
            $rest = array_flip(array_diff($keys, $repKeys));
            foreach ($this->oldBaseRows(array_keys($rest), ['sono', 'pino', 'dino']) as $row) {
                foreach (['sono', 'pino', 'dino'] as $c) {
                    if ($row->$c !== null && isset($rest[$row->$c])) {
                        $oldKeys[$row->$c] = true;
                    }
                }
            }
            $notFound = array_keys(array_diff_key($rest, $oldKeys));
            foreach (array_keys($this->oldBaseTruncatedMatches($notFound, ['sono', 'pino', 'dino'])) as $k) {
                $oldKeys[$k] = true;
            }
            $oldKeys = array_keys($oldKeys);
        }

        $rowKeys = self::ROW_KEYS_SQL;
        $inRep = "{$rowKeys} && ?::text[]";

        if ($source === 'replication') {
            $query->whereRaw($inRep, [self::pgArray($repKeys)]);
        } elseif ($source === 'old') {
            $query->whereRaw("NOT ({$inRep})", [self::pgArray($repKeys)])
                  ->whereRaw("{$rowKeys} && ?::text[]", [self::pgArray($oldKeys)]);
        } elseif ($source === 'none') {
            $query->whereRaw("NOT ({$inRep})", [self::pgArray($repKeys)])
                  ->whereRaw("NOT ({$rowKeys} && ?::text[])", [self::pgArray($oldKeys)]);
        }
    }

    /**
     * ISCODE (replication) documents exposed with the same column names as dbctl.ct_so_head,
     * so every query below stays identical to LineSoController.
     */
    private function soHead()
    {
        return DB::connection('replication')
            ->query()
            ->fromRaw('(' . self::SO_HEAD_SQL . ') as ct_so_head');
    }

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
                SUM(CASE WHEN service_name NOT ILIKE '%ขนาดใหญ่%' AND service_name NOT ILIKE '%จดหมายในประเทศ - ซอง%' THEN COALESCE(special_zone_rate, 0) ELSE 0 END) as special_zone_for_diff,
                SUM(
                    CASE
                        WHEN dl_calculated_cost IS NOT NULL THEN
                            CEIL(ROUND(weight_grams * 10000) / 100.0) / 100.0
                        WHEN ems_calculated_cost IS NOT NULL THEN
                            CEIL(weight_grams)
                        ELSE
                            weight_grams
                    END
                ) as weight_kg,
                COUNT(*) as total_count
            ")
            ->first();

        $transport   = (float) ($result->transport ?? 0);
        $serviceFee  = (float) ($result->service_fee ?? 0);
        $specialZoneForDiff = (float) ($result->special_zone_for_diff ?? 0);

        return response()->json([
            'weight_grams'      => (float) ($result->weight_grams ?? 0),
            'service_fee'       => $serviceFee,
            'special_zone_rate' => (float) ($result->special_zone_rate ?? 0),
            'transport'         => $transport,
            'weight_kg'         => (float) ($result->weight_kg ?? 0),
            'diff'              => $serviceFee - $transport - $specialZoneForDiff,
            'total_count'       => (int) ($result->total_count ?? 0),
        ]);
    }

    public function fieldSaleAreas(): JsonResponse
    {
        $specialCustIds = array_map('strtolower', array_keys(self::CUSTID_AREA_MAP));
        $placeholders   = implode(',', array_fill(0, count($specialCustIds), '?'));

        $areas = $this->soHead()
            ->whereNotNull('fieldsalename')
            ->where('fieldsalename', '!=', '')
            ->whereRaw("lower(trim(custid)) NOT IN ({$placeholders})", $specialCustIds)
            ->whereRaw("trim(fieldsaleid) != '9980-0'")
            ->where('fieldsaleid', 'not like', '7%')
            ->where('fieldsaleid', 'not like', '8%')
            ->where('fieldsaleid', 'not like', '2%')
            ->distinct()
            ->orderBy('fieldsalename')
            ->pluck('fieldsalename');

        return response()->json($areas);
    }

    public function export(Request $request): JsonResponse
    {
        $items = $this->buildQuery($request)->limit(50000)->get();

        $merged = $this->mergeSoHeadData($items);

        AuditLog::record(
            'export',
            'line_so_report_replication',
            0,
            'Line SO Report (Replication)',
            [
                'search' => $request->query('search'),
                'pi_no' => $request->query('pi_no'),
                'pi_type' => $request->query('pi_type'),
                'date_from' => $request->query('date_from'),
                'date_to' => $request->query('date_to'),
                'no_pi_number' => $request->boolean('no_pi_number'),
                'area' => $request->query('area'),
                'service_type' => $request->query('service_type'),
                'match_source' => $request->query('match_source'),
                'record_count' => count($merged),
            ]
        );

        return response()->json($merged);
    }

    private function buildQuery(Request $request)
    {
        $s = $request->filled('search') ? $request->search : null;

        // Step 1: If search, pre-fetch matching PINo/DINo list from ISCODE
        $matchedPiNos = collect();
        $matchedDiNos = collect();
        if ($s) {
            $matchedData = $this->soHead()
                ->where('pino', 'ilike', "%{$s}%")
                ->orWhere('custname', 'ilike', "%{$s}%")
                ->orWhere('sono', 'ilike', "%{$s}%")
                ->orWhere('pono', 'ilike', "%{$s}%")
                ->orWhere('dino', 'ilike', "%{$s}%")
                ->orWhere('sino', 'ilike', "%{$s}%")
                ->get(['pino', 'dino']);

            $matchedPiNos = $matchedData->pluck('pino')->filter()->unique();
            $matchedDiNos = $matchedData->pluck('dino')->filter()->unique();
        }

        // Step 1b: document numbers in product_details → PINo / DINo (joined as "pd"; one dummy row keeps the join valid)
        $pdRows = $this->productDetailDocMap() ?: [[null, null, null]];
        $pdValues = implode(',', array_fill(0, count($pdRows), '(CAST(? AS text), CAST(? AS text), CAST(? AS text))'));
        $pdBindings = array_merge(...$pdRows);

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
                'ps.di_number',
                'ps.fi_number',
                'ps.customer_name',
                'ps.product_details',
                'spz.rate as special_zone_rate',
                'pat.name as account_type_name',
                DB::raw(self::EFF_PI . ' as eff_pi'),
                DB::raw(self::EFF_DI . ' as eff_di'),
                DB::raw("
                    CASE WHEN thpa.service_name ILIKE '%EMS%' THEN (
                        SELECT CEIL(er.rate + COALESCE(
                            (SELECT value FROM ems_settings WHERE key = 'offset' LIMIT 1), 0
                        ))
                        FROM ems_rates er
                        WHERE er.weight >= CEIL(thpa.weight_grams)
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
                        WHERE dlr.weight >= CEIL(thpa.weight_grams * 100.0) / 100.0
                        ORDER BY dlr.weight ASC
                        LIMIT 1
                    ) ELSE NULL END AS dl_calculated_cost
                "),
            ])
            ->leftJoin('postone_shipments as ps', 'ps.tracking_no', '=', 'thpa.barcode')
            ->leftJoin('special_postal_zones as spz', 'spz.office_name', '=', 'thpa.destination_name')
            ->leftJoin('postone_account_types as pat', 'pat.id', '=', 'ps.account_type_id')
            ->leftJoin('line_group_files as lgf', 'lgf.id', '=', 'thpa.parent_file_id')
            ->leftJoin(DB::raw("(VALUES {$pdValues}) as pd(doc, pino, dino)"), 'pd.doc', '=', DB::raw('(' . self::PDOC_SQL . ')'))
            ->addBinding($pdBindings, 'join')
            ->where(function ($q) {
                $q->whereNull('thpa.parent_file_id')
                  ->orWhere('lgf.is_active', true);
            })
            ->orderByDesc('thpa.deposit_datetime');

        if ($s) {
            $query->where(function ($q) use ($s, $matchedPiNos, $matchedDiNos) {
                $q->where('thpa.barcode', 'ilike', "%{$s}%")
                  ->orWhere('ps.so_number', 'ilike', "%{$s}%")
                  ->orWhere(self::effDi(), 'ilike', "%{$s}%")
                  ->orWhere('ps.fi_number', 'ilike', "%{$s}%")
                  ->orWhere('ps.product_details', 'ilike', "%{$s}%");
                if ($matchedPiNos->isNotEmpty()) {
                    $q->orWhereIn(self::effPi(), $matchedPiNos)
                      ->orWhereIn('ps.fi_number', $matchedPiNos);
                }
                if ($matchedDiNos->isNotEmpty()) {
                    $q->orWhereIn(self::effDi(), $matchedDiNos)
                      ->orWhereIn('ps.fi_number', $matchedDiNos);
                }
            });
        }

        if ($request->filled('pi_no')) {
            $like = '%' . addcslashes(trim($request->string('pi_no')->toString()), '%_\\') . '%';
            $this->applyPiNoFilter($query, $like);
        }

        // PI type: PISO (from SO) / PIOO (from OO) / PIIO (from IO)
        $piType = strtoupper((string) $request->query('pi_type', ''));
        if (in_array($piType, ['PISO', 'PIOO', 'PIIO'], true)) {
            $this->applyPiNoFilter($query, $piType . '-%');
        }

        if ($request->filled('date_from')) {
            // Use regex to ensure valid date format before casting to prevent 500 error on invalid dates from n8n
            $query->whereRaw("CASE WHEN thpa.deposit_datetime ~ '^\d{4}-\d{2}-\d{2}' THEN thpa.deposit_datetime::date >= ? ELSE false END", [$request->date_from]);
        }

        if ($request->filled('date_to')) {
            $query->whereRaw("CASE WHEN thpa.deposit_datetime ~ '^\d{4}-\d{2}-\d{2}' THEN thpa.deposit_datetime::date <= ? ELSE false END", [$request->date_to]);
        }

        if ($request->boolean('no_pi_number')) {
            // หา so_number, di_number ของ record ที่ไม่มี pi_number และ fi_number แล้วเช็คว่ามีใน ISCODE หรือเปล่า
            $noPiSoNos = $query->clone()
                ->whereNull(self::effPi())
                ->whereNull('ps.fi_number')
                ->whereNotNull('ps.so_number')
                ->pluck('ps.so_number')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $noPiDiNos = $query->clone()
                ->whereNull(self::effPi())
                ->whereNull('ps.fi_number')
                ->whereNotNull(self::effDi())
                ->pluck('eff_di')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $soNosInIscode = [];
            if (!empty($noPiSoNos)) {
                $soNosInIscode = $this->soHead()
                    ->whereIn('sono', $noPiSoNos)
                    ->pluck('sono')
                    ->unique()
                    ->all();
            }

            $diNosInIscode = [];
            if (!empty($noPiDiNos)) {
                $diNosInIscode = $this->soHead()
                    ->whereIn('dino', $noPiDiNos)
                    ->pluck('dino')
                    ->unique()
                    ->all();
            }

            // ไม่พบ = ไม่มี pi/fi number AND (so_number เป็น null หรือไม่ตรงกับ sono ใน ISCODE) AND (di_number เป็น null หรือไม่ตรงกับ dino ใน ISCODE)
            $query->whereNull(self::effPi())
                  ->whereNull('ps.fi_number');
            $query->where(function ($q) use ($soNosInIscode, $diNosInIscode) {
                $q->where(function ($inner) use ($soNosInIscode) {
                    $inner->whereNull('ps.so_number');
                    if (!empty($soNosInIscode)) {
                        $inner->orWhereNotIn('ps.so_number', $soNosInIscode);
                    }
                })
                ->where(function ($inner) use ($diNosInIscode) {
                    $inner->whereNull(self::effDi());
                    if (!empty($diNosInIscode)) {
                        $inner->orWhereNotIn(self::effDi(), $diNosInIscode);
                    }
                });
            });
        }

        if ($request->filled('service_type')) {
            $query->where('thpa.service_name', 'ilike', '%' . $request->service_type . '%');
        }

        if ($request->boolean('no_iscode') || $request->filled('area')) {
            // เดิมโค้ดนี้ clone query ที่ join 5 ตาราง (พร้อม subquery คำนวณค่าส่ง EMS/จดหมายต่อแถว)
            // แล้วรัน pluck() แยก 3 รอบ (pi_number, fi_number, di_number) = สแกนข้อมูลชุดเดียวกันซ้ำ 3 ครั้ง
            // รวมเป็น query เดียว พร้อมตัด select เหลือแค่ 3 คอลัมน์ที่ใช้จริง และลบ orderBy ที่ไม่จำเป็นสำหรับการ pluck ทิ้ง
            $activeRows = $query->clone()
                ->reorder()
                ->select(['ps.fi_number', DB::raw(self::EFF_PI . ' as eff_pi'), DB::raw(self::EFF_DI . ' as eff_di')])
                ->get();

            $activePiNos = $activeRows->pluck('eff_pi')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $activeFiNos = $activeRows->pluck('fi_number')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $mergedActivePiNos = array_unique(array_merge($activePiNos, $activeFiNos));

            $activeDiNos = $activeRows->pluck('eff_di')
                ->unique()
                ->filter()
                ->values()
                ->all();

            $existingIscodePiNos = [];
            if (!empty($mergedActivePiNos)) {
                $matchedIscodeForPi = $this->soHead()
                    ->whereIn('pino', $mergedActivePiNos)
                    ->orWhereIn('dino', $mergedActivePiNos)
                    ->get(['pino', 'dino']);

                $existingIscodePiNos = $matchedIscodeForPi->pluck('pino')
                    ->concat($matchedIscodeForPi->pluck('dino'))
                    ->filter()
                    ->unique()
                    ->all();
            }

            $existingIscodeDiNos = [];
            if (!empty($activeDiNos)) {
                $existingIscodeDiNos = $this->soHead()
                    ->whereIn('dino', $activeDiNos)
                    ->pluck('dino')
                    ->unique()
                    ->all();
            }

            if ($request->boolean('no_iscode')) {
                $query->where(function ($q) use ($existingIscodePiNos, $existingIscodeDiNos) {
                    $q->where(function ($subQ) use ($existingIscodePiNos) {
                        $subQ->where(function ($inner) {
                            $inner->whereNull(self::effPi())
                                  ->whereNull('ps.fi_number');
                        });
                        if (!empty($existingIscodePiNos)) {
                            $subQ->orWhere(function ($inner) use ($existingIscodePiNos) {
                                $inner->whereNotIn(self::effPi(), $existingIscodePiNos)
                                      ->whereNotIn('ps.fi_number', $existingIscodePiNos);
                            });
                        }
                    })
                    ->where(function ($subQ) use ($existingIscodeDiNos) {
                        $subQ->whereNull(self::effDi());
                        if (!empty($existingIscodeDiNos)) {
                            $subQ->orWhereNotIn(self::effDi(), $existingIscodeDiNos);
                        }
                    });
                });
            }

            if ($request->filled('area')) {
                $this->applyAreaFilterOptimized($query, trim($request->area), $mergedActivePiNos, $existingIscodePiNos, $activeDiNos, $existingIscodeDiNos);
            }
        }

        // แหล่งที่พบ: replication | old (Base เก่า) | none
        $matchSource = (string) $request->query('match_source', '');
        if (in_array($matchSource, ['replication', 'old', 'none'], true)) {
            $this->applyMatchSourceFilter($query, $matchSource);
        }

        return $query;
    }

    /**
     * PI No filter ($like is an ILIKE pattern). A row matches when its own pi_number / fi_number matches,
     * or when it links (same rules as mergeSoHeadData) to an ISCODE document whose PINo matches.
     * Lists are bound as one Postgres array each — "PISO" alone can match >10k documents.
     */
    private function applyPiNoFilter($query, string $like): void
    {
        $rows = $this->soHead()->where('pino', 'ilike', $like)->get(['pino', 'dino', 'sono']);
        $pinos = $rows->pluck('pino')->filter()->unique()->values()->all();
        $dinos = $rows->pluck('dino')->filter()->unique()->values()->all();
        $sonos = $rows->pluck('sono')->filter()->unique()->values()->all();

        $toPgArray = fn (array $v) => '{' . implode(',', array_map(
            fn ($s) => '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $s) . '"', $v
        )) . '}';

        $query->where(function ($q) use ($like, $pinos, $dinos, $sonos, $toPgArray) {
            $q->where(self::effPi(), 'ilike', $like)
              ->orWhere('ps.fi_number', 'ilike', $like);
            if ($pinos) {
                $q->orWhereRaw(self::EFF_PI . ' = ANY(?::text[])', [$toPgArray($pinos)])
                  ->orWhereRaw('ps.fi_number = ANY(?::text[])', [$toPgArray($pinos)]);
            }
            if ($dinos) {
                $q->orWhereRaw(self::EFF_DI . ' = ANY(?::text[])', [$toPgArray($dinos)])
                  ->orWhereRaw(self::EFF_PI . ' = ANY(?::text[])', [$toPgArray($dinos)])
                  ->orWhereRaw('ps.fi_number = ANY(?::text[])', [$toPgArray($dinos)]);
            }
            if ($sonos) {
                $q->orWhereRaw('ps.so_number = ANY(?::text[])', [$toPgArray($sonos)]);
            }
        });
    }

    private function applyAreaFilterOptimized($query, string $area, array $activePiNos, array $existingIscodePiNos, array $activeDiNos, array $existingIscodeDiNos): void
    {
        $custidAreaMap  = array_flip(self::CUSTID_AREA_MAP); // area → custid
        $prefixAreaMap  = array_flip(self::PREFIX_AREA_MAP); // area → prefix
        $specialCustIds = array_map('strtolower', array_keys(self::CUSTID_AREA_MAP));

        $filteredPiNos = [];
        $filteredDiNos = [];

        $isBKK = ($area === 'BKK' || $area === 'TT BKK');
        $isUPC = ($area === 'UPC' || $area === 'TT UPC');
        $isMT  = ($area === 'MT');

        $isIscodeArea = isset($custidAreaMap[$area])
            || isset($prefixAreaMap[$area])
            || $isBKK
            || $isUPC
            || $area === 'Aftersale service';

        // For non-ISCODE areas, pre-fetch pinos/dinos where fieldsalename matches (fallback area)
        $fieldSalePiNos = [];
        $fieldSaleDiNos = [];
        if (!$isIscodeArea && (!empty($activePiNos) || !empty($activeDiNos))) {
            $fsQuery = $this->soHead()
                ->where('fieldsalename', $area)
                ->where(function ($q) use ($activePiNos, $activeDiNos) {
                    if (!empty($activePiNos) && !empty($activeDiNos)) {
                        $q->where(function ($inner) use ($activePiNos) {
                            $inner->whereIn('pino', $activePiNos)->orWhereIn('dino', $activePiNos);
                        })->orWhereIn('dino', $activeDiNos);
                    } elseif (!empty($activePiNos)) {
                        $q->whereIn('pino', $activePiNos)->orWhereIn('dino', $activePiNos);
                    } else {
                        $q->whereIn('dino', $activeDiNos);
                    }
                });
            $fsRows = $fsQuery->get(['pino', 'dino']);
            $fieldSalePiNos = $fsRows->pluck('pino')->filter()->unique()->all();
            $fieldSaleDiNos = $fsRows->pluck('dino')->filter()->unique()->all();
        }

        if ($isIscodeArea && (!empty($activePiNos) || !empty($activeDiNos))) {
            $dbctlQuery = $this->soHead()
                ->where(function ($q) use ($activePiNos, $activeDiNos) {
                    if (!empty($activePiNos) && !empty($activeDiNos)) {
                        $q->where(function ($inner) use ($activePiNos) {
                            $inner->whereIn('pino', $activePiNos)
                                  ->orWhereIn('dino', $activePiNos);
                        })->orWhereIn('dino', $activeDiNos);
                    } elseif (!empty($activePiNos)) {
                        $q->whereIn('pino', $activePiNos)
                          ->orWhereIn('dino', $activePiNos);
                    } elseif (!empty($activeDiNos)) {
                        $q->whereIn('dino', $activeDiNos);
                    }
                });

            if ($area === 'Aftersale service') {
                $dbctlQuery->where(function ($q) {
                    $q->whereRaw("lower(trim(custid)) = '9980-0'")
                      ->orWhereRaw("trim(fieldsaleid) = '9980-0'");
                });

            } elseif (isset($custidAreaMap[$area])) {
                $custid = strtolower($custidAreaMap[$area]);
                $dbctlQuery->whereRaw('lower(trim(custid)) = ?', [$custid]);

            } else {
                $dbctlQuery->where(function ($q) use ($isBKK, $isUPC, $isMT, $specialCustIds, $area) {
                    $q->where(function ($subQ) use ($isBKK, $isUPC, $isMT) {
                        if ($isBKK) {
                            $subQ->where('fieldsaleid', 'like', '7%');
                        } elseif ($isUPC) {
                            $subQ->where('fieldsaleid', 'like', '8%');
                        } elseif ($isMT) {
                            $subQ->where('fieldsaleid', 'like', '2%');
                        }
                    });

                    $prefixes = [];
                    if ($isBKK) {
                        $prefixes = ['70'];
                    } elseif ($isUPC) {
                        $prefixes = ['80'];
                    } elseif ($isMT) {
                        $prefixes = ['20'];
                    } else {
                        $prefixes = array_keys(array_filter(self::PREFIX_AREA_MAP, fn($a) => $a === $area));
                    }

                    if (!empty($prefixes)) {
                        $q->orWhere(function ($subQ) use ($prefixes, $specialCustIds) {
                            $subQ->where(function ($inner) use ($specialCustIds) {
                                    $inner->whereNotIn(DB::raw('lower(trim(custid))'), $specialCustIds)
                                          ->orWhereNull('custid');
                                })
                                ->where(function ($inner) {
                                    $inner->whereRaw("trim(fieldsaleid) != '9980-0'")
                                          ->orWhereNull('fieldsaleid');
                                })
                                ->where(function ($inner) {
                                    $inner->where('fieldsaleid', 'not like', '7%')
                                          ->where('fieldsaleid', 'not like', '8%')
                                          ->where('fieldsaleid', 'not like', '2%')
                                          ->orWhereNull('fieldsaleid');
                                })
                                ->where(function ($inner) use ($prefixes) {
                                    foreach ($prefixes as $prefix) {
                                        $inner->orWhere(function ($inner2) use ($prefix) {
                                            $inner2->where(function ($p) use ($prefix) {
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
                        });
                    }
                });
            }

            $matchedRows = $dbctlQuery->get(['pino', 'dino']);
            $filteredPiNos = $matchedRows->pluck('pino')->filter()->unique()->all();
            $filteredDiNos = $matchedRows->pluck('dino')->filter()->unique()->all();
        }

        $query->where(function ($q) use ($filteredPiNos, $filteredDiNos, $existingIscodePiNos, $existingIscodeDiNos, $area, $isIscodeArea, $fieldSalePiNos, $fieldSaleDiNos) {
            if ($isIscodeArea) {
                $q->whereIn(self::effPi(), $filteredPiNos)
                  ->orWhereIn('ps.fi_number', $filteredPiNos)
                  ->orWhereIn(self::effDi(), $filteredDiNos);
            } else {
                // Arm 1: ไม่มีข้อมูล ISCODE → filter ด้วย account type
                $q->where(function ($s) use ($area, $existingIscodePiNos, $existingIscodeDiNos) {
                    $s->where('pat.name', $area)
                        ->where(function ($sub) use ($existingIscodePiNos) {
                            $sub->where(function ($inner) {
                                $inner->whereNull(self::effPi())
                                      ->whereNull('ps.fi_number');
                            });
                            if (!empty($existingIscodePiNos)) {
                                $sub->orWhere(function ($inner) use ($existingIscodePiNos) {
                                    $inner->whereNotIn(self::effPi(), $existingIscodePiNos)
                                          ->whereNotIn('ps.fi_number', $existingIscodePiNos);
                                });
                            }
                        })
                        ->where(function ($sub) use ($existingIscodeDiNos) {
                            $sub->whereNull(self::effDi());
                            if (!empty($existingIscodeDiNos)) {
                                $sub->orWhereNotIn(self::effDi(), $existingIscodeDiNos);
                            }
                        });
                });
                // Arm 2: มีข้อมูล ISCODE แต่ไม่ตรง map → filter ด้วย fieldsalename (fallback area)
                if (!empty($fieldSalePiNos)) {
                    $q->orWhereIn(self::effPi(), $fieldSalePiNos)
                      ->orWhereIn('ps.fi_number', $fieldSalePiNos);
                }
                if (!empty($fieldSaleDiNos)) {
                    $q->orWhereIn(self::effDi(), $fieldSaleDiNos);
                }
            }
        });
    }

    private function mergeSoHeadData($items)
    {
        $selectCols = ['sodate', 'sono', 'pino', 'dino', 'pono', 'custid', 'custname', 'numofitem', 'fieldsaleid', 'fieldsalename', 'createby', 'createbyname', 'docremark', 'accremark'];

        // Step 3a: Fetch by pi_number / fi_number → pino / dino (split comma-separated values)
        $piNos = collect($items)
            ->flatMap(function ($item) {
                $piList = array_map('trim', explode(',', $item->pi_number ?? ''));
                $fiList = array_map('trim', explode(',', $item->fi_number ?? ''));
                return array_merge($piList, $fiList);
            })
            ->filter()
            ->unique()
            ->values()
            ->all();

        $soHeadByPino = collect();
        $soHeadByDinoFromPi = collect();
        if (!empty($piNos)) {
            $soHeadByPino = $this->soHead()
                ->select($selectCols)
                ->whereIn('pino', $piNos)
                ->get()
                ->keyBy('pino');

            $soHeadByDinoFromPi = $this->soHead()
                ->select($selectCols)
                ->whereIn('dino', $piNos)
                ->get()
                ->keyBy('dino');
        }

        // Step 3b: Fetch by so_number → sono (fallback for records without pi_number match)
        $soNos = collect($items)->pluck('so_number')->filter()->unique()->values()->all();

        $soHeadBySono = collect();
        if (!empty($soNos)) {
            $soHeadBySono = $this->soHead()
                ->select($selectCols)
                ->whereIn('sono', $soNos)
                ->get()
                ->keyBy('sono');
        }

        // Step 3c: Fetch by di_number → dino
        $diNos = collect($items)->pluck('di_number')->filter()->unique()->values()->all();

        $soHeadByDino = collect();
        if (!empty($diNos)) {
            $soHeadByDino = $this->soHead()
                ->select($selectCols)
                ->whereIn('dino', $diNos)
                ->get()
                ->keyBy('dino');
        }

        // Step 3d: Fallback — document numbers written in product_details
        // (e.g. "SI-261100292 สินค้า 6 รายการ", "PIIO-261100519") when pi/so/di columns are empty
        $extractDocNos = function ($item): array {
            preg_match_all('/\b(?:PI(?:SO|OO|IO)|PPIO|DI|SI|SH|SO|OO|IO)-\d+/i', $item->product_details ?? '', $m);
            return array_values(array_unique(array_map(
                fn ($n) => preg_replace('/^PPIO-/', 'PIIO-', strtoupper($n)), // PPIO- is a typo of PIIO-
                $m[0]
            )));
        };
        $docNos = collect($items)->flatMap($extractDocNos)->unique()->values()->all();

        $soHeadByDocNo = collect();
        if (!empty($docNos)) {
            $found = $this->soHead()
                ->select(array_merge($selectCols, ['sino', 'shno']))
                ->where(fn ($q) => $q->whereIn('pino', $docNos)
                    ->orWhereIn('dino', $docNos)
                    ->orWhereIn('sino', $docNos)
                    ->orWhereIn('sono', $docNos)
                    ->orWhereIn('shno', $docNos))
                ->get();
            foreach (['pino', 'dino', 'sino', 'sono', 'shno'] as $col) {
                foreach ($found as $row) {
                    if ($row->$col && !$soHeadByDocNo->has($row->$col)) {
                        $soHeadByDocNo->put($row->$col, $row);
                    }
                }
            }
        }

        $findReplication = function ($item) use ($soHeadByPino, $soHeadByDinoFromPi, $soHeadBySono, $soHeadByDino, $soHeadByDocNo, $extractDocNos) {
            // pi_number หรือ fi_number อาจเป็น comma-separated → ลอง match ทีละตัว
            $piList = collect(explode(',', $item->pi_number ?? ''))
                ->concat(explode(',', $item->fi_number ?? ''))
                ->map(fn($p) => trim($p))
                ->filter();

            return $piList->map(fn($p) => $soHeadByPino->get($p))->filter()->first()
               ?? $piList->map(fn($p) => $soHeadByDinoFromPi->get($p))->filter()->first()
               ?? $soHeadBySono->get($item->so_number)
               ?? $soHeadByDino->get($item->di_number)
               ?? collect($extractDocNos($item))->map(fn ($n) => $soHeadByDocNo->get($n))->filter()->first();
        };

        // Step 3e: rows not found in Replication → look up the old base (dbctl.ct_so_head, data up to 2026-10-02)
        $repMatch = collect($items)->map($findReplication);
        $oldKeys = collect($items)
            ->filter(fn ($item, $i) => !$repMatch[$i])
            ->flatMap(fn ($item) => $this->rowKeys($item))
            ->unique()->values()->all();
        $oldByKey = $this->oldBaseByKey($oldKeys, $selectCols);

        // Step 4: Merge ISCODE data into each row
        $rows = collect($items)->values()->map(function ($item, $i) use ($repMatch, $oldByKey) {
            $so = $repMatch[$i];
            $source = $so ? 'Replication' : null;
            if (!$so) {
                $so = collect($this->rowKeys($item))->map(fn ($k) => $oldByKey->get($k))->filter()->first();
                $source = $so ? 'Base เก่า' : null;
            }

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
                } elseif (str_starts_with($fieldsaleid, '7')) {
                    $area = 'BKK';
                } elseif (str_starts_with($fieldsaleid, '8')) {
                    $area = 'UPC';
                } elseif (str_starts_with($fieldsaleid, '2')) {
                    $area = 'MT';
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
                    if ($area === null) {
                        $area = trim($so->fieldsalename ?? '') ?: null;
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
                'MatchSource'   => $source,
            ]);
        });

        // Step 5: แผนก — default = แผนกที่ส่ง (account type); Area MT → Cust_Master.CustGroupId of CustId
        $mtCustIds = $rows->where('Area', 'MT')->pluck('CustID')->filter()->unique()->values()->all();

        $custGroupById = collect();
        if (!empty($mtCustIds)) {
            $custGroupById = DB::connection('replication')
                ->table('Cust_Master')
                ->whereIn('CustId', $mtCustIds)
                ->pluck('CustGroupId', 'CustId');
        }

        return $rows->map(function ($row) use ($custGroupById) {
            $row['Department'] = $row['Area'] === 'MT'
                ? ($custGroupById->get($row['CustID']) ?? $row['account_type_name'] ?? null)
                : ($row['account_type_name'] ?? null);
            return $row;
        })->values();
    }
}
