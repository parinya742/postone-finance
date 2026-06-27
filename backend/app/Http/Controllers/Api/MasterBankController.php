<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MasterBankController extends Controller
{
    public function index(): JsonResponse
    {
        $banks = DB::connection('n8n')
            ->table('master_banks')
            ->orderBy('bank_name_th')
            ->get();

        return response()->json($banks);
    }
}
