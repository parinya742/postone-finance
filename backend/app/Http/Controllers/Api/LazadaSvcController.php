<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * เครื่องมือโปรโมทสินค้า — Lazada Sponsored/Marketing Balance (SVC) ledger.
 */
class LazadaSvcController extends Controller
{
    /** One shop name per short_code (= seller_key in svc tables). */
    private function shopNames(): Builder
    {
        return DB::connection('n8n')
            ->table('lazada_transaction_tokens')
            ->selectRaw('DISTINCT ON (short_code) short_code, shop_name')
            ->whereNotNull('short_code')
            ->orderBy('short_code')
            ->orderByDesc('id');
    }

    private function filteredTransactions(Request $request): Builder
    {
        $q = DB::connection('n8n')
            ->table('lazada_svc_transactions as t')
            ->leftJoinSub($this->shopNames(), 's', 's.short_code', '=', 't.seller_key');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('t.statement_id', 'ilike', "%{$s}%")
                   ->orWhere('t.order_number', 'ilike', "%{$s}%")
                   ->orWhere('t.order_line_id', 'ilike', "%{$s}%")
                   ->orWhere('t.promotion_id', 'ilike', "%{$s}%")
                   ->orWhere('t.remarks', 'ilike', "%{$s}%");
            });
        }

        foreach (['seller_key', 'operation', 'program', 'objective', 'business_type'] as $col) {
            if ($request->filled($col)) {
                $q->where("t.{$col}", $request->input($col));
            }
        }

        if ($request->filled('export_file_id')) {
            $q->where('t.export_file_id', $request->integer('export_file_id'));
        }

        if ($request->filled('start_date')) {
            $q->where('t.credit_transaction_time', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('t.credit_transaction_time', '<=', $request->end_date . ' 23:59:59');
        }

        return $q;
    }

    public function index(Request $request): JsonResponse
    {
        $page = $this->filteredTransactions($request)
            ->select([
                't.id', 't.seller_key', 's.shop_name', 't.statement_id',
                't.credit_transaction_time', 't.order_create_time',
                't.business_type', 't.operation', 't.amount', 't.currency',
                't.program', 't.objective', 't.remarks',
                't.order_number', 't.order_line_id', 't.promotion_id',
                't.export_file_id', 't.created_at', 't.updated_at',
            ])
            ->orderByDesc('t.credit_transaction_time')
            ->orderByDesc('t.id')
            ->paginate(min($request->integer('per_page', 50), 50000));

        // Totals per operation for the whole filtered set (not just this page)
        $summary = $this->filteredTransactions($request)
            ->selectRaw('t.operation, COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS amount')
            ->groupBy('t.operation')
            ->get();

        return response()->json(array_merge($page->toArray(), [
            'summary' => [
                'by_operation' => $summary,
                'net'          => (float) $summary->sum('amount'),
            ],
        ]));
    }

    /** Distinct values for filter dropdowns. */
    public function options(): JsonResponse
    {
        $db = DB::connection('n8n');
        $distinct = fn (string $col) => $db->table('lazada_svc_transactions')
            ->whereNotNull($col)->distinct()->orderBy($col)->pluck($col);

        return response()->json([
            'operations'     => $distinct('operation'),
            'programs'       => $distinct('program'),
            'objectives'     => $distinct('objective'),
            'business_types' => $distinct('business_type'),
        ]);
    }

    public function files(Request $request): JsonResponse
    {
        $linked = DB::connection('n8n')
            ->table('lazada_svc_transactions')
            ->selectRaw('export_file_id, COUNT(*) AS tx_count, COALESCE(SUM(amount), 0) AS tx_amount')
            ->groupBy('export_file_id');

        $q = DB::connection('n8n')
            ->table('lazada_svc_export_files as f')
            ->leftJoinSub($linked, 'l', 'l.export_file_id', '=', 'f.id')
            ->select('f.*', DB::raw('COALESCE(l.tx_count, 0) AS tx_count'), DB::raw('l.tx_amount'))
            ->orderByDesc('f.created_at');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('f.shop_name', 'ilike', "%{$s}%")
                   ->orWhere('f.file_name', 'ilike', "%{$s}%")
                   ->orWhere('f.lazada_filename', 'ilike', "%{$s}%")
                   ->orWhere('f.seller_key', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('seller_key')) {
            $q->where('f.seller_key', $request->seller_key);
        }

        if ($request->filled('status')) {
            $q->where('f.status', $request->status);
        }

        // Most exports are empty single-day pulls; let the user hide them
        if ($request->boolean('has_rows')) {
            $q->where('f.row_count', '>', 0);
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }
}
