<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SoHeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DB::connection('dbctl')
            ->table('ct_so_head')
            ->selectRaw('
                sodate      as "SODate",
                sono        as "SoNo",
                pino        as "PINo",
                dino        as "DINo",
                pono        as "PONo",
                custid      as "CustID",
                custname    as "CustName",
                numofitem   as "NumOfItem",
                fieldsaleid   as "FieldSaleID",
                fieldsalename as "FieldSaleName",
                createby      as "CreateBy",
                createbyname  as "CreateByName",
                docremark   as "DocRemark",
                accremark   as "ACCRemark"
            ');

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('custname', 'ilike', "%{$s}%")
                  ->orWhere('sono', 'ilike', "%{$s}%")
                  ->orWhere('pino', 'ilike', "%{$s}%")
                  ->orWhere('dino', 'ilike', "%{$s}%")
                  ->orWhere('pono', 'ilike', "%{$s}%")
                  ->orWhere('fieldsalename', 'ilike', "%{$s}%");
            });
        }

        $paginated = $query->paginate($request->integer('per_page', 15));

        return response()->json($paginated);
    }
}
