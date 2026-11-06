<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SO / OO / IO documents linked to PI (ISCODE replication database).
 * Uses the "replication" connection (DB_*_REPLICATION in .env).
 */
class SoDocumentController extends Controller
{
    private const BASE_SQL = <<<'SQL'
        SELECT
            so."SODate",
            so."SONo",
            so."SOStatus",
            oo."OODate",
            oo."OONo",
            io."IODate",
            io."IONo",
            pi."PIDate",
            pi."PINo",
            pi."PIStatus",
            CASE
                WHEN so."SONo" IS NOT NULL THEN 'SO'
                WHEN oo."OONo" IS NOT NULL THEN 'OO'
                WHEN io."IONo" IS NOT NULL THEN 'IO'
                ELSE 'Other'
            END AS "SourceType",
            sh."DINo",
            sh."SINo",
            so."RefPONo",
            so."CustId",
            so."CustType",
            so."CustName",
            so."CountItem",
            so."SaleReptId",
            so."SaleReptName",
            so."CreateBy",
            so."CreateByName",
            so."SORemark",
            so."ACCRemark"
        FROM "PI_Head" pi
        LEFT JOIN "SH_Head" sh ON pi."FromDocNo" = sh."SHNo"
        LEFT JOIN "SO_Head" so ON sh."AllSONo" = so."SONo"
        LEFT JOIN "OO_Head" oo ON pi."FromDocNo" = oo."OONo"
        LEFT JOIN "IO_Head" io ON pi."FromDocNo" = io."IONo"
        WHERE so."SONo" IS NOT NULL OR oo."OONo" IS NOT NULL OR io."IONo" IS NOT NULL
        SQL;

    private const SEARCH_COLUMNS = [
        'SONo', 'OONo', 'IONo', 'PINo', 'DINo', 'SINo',
        'RefPONo', 'CustId', 'CustName', 'SaleReptName',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = DB::connection('replication')
            ->query()
            ->fromRaw('(' . self::BASE_SQL . ') as t');

        if ($request->filled('search')) {
            $s = $request->string('search')->toString();
            $query->where(function ($q) use ($s) {
                foreach (self::SEARCH_COLUMNS as $col) {
                    $q->orWhere($col, 'ilike', "%{$s}%");
                }
            });
        }

        if ($request->filled('source_type')) {
            $query->where('SourceType', $request->string('source_type')->upper()->toString());
        }

        $query->orderByDesc('PIDate')->orderByDesc('PINo');

        $paginated = $query->paginate(min($request->integer('per_page', 15), 200));

        return response()->json($paginated);
    }
}
