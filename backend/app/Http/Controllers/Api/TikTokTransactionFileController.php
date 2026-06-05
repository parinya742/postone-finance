<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TikTokTransactionFileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('tiktok_transaction_files')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('shop_name', 'ilike', "%{$s}%")
                   ->orWhere('file_name', 'ilike', "%{$s}%")
                   ->orWhere('shops_code', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }
}
