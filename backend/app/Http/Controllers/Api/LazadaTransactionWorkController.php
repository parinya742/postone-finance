<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LazadaTransactionWorkController extends Controller
{
    public function bulkTransfer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'            => 'required|array|min:1',
            'ids.*'          => 'integer',
            'transferred_at' => 'nullable|date',
            'start_date'     => 'nullable|date',
            'end_date'       => 'nullable|date',
        ]);

        $updated = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->whereIn('id', $data['ids'])
            ->update(['transferred_at' => $data['transferred_at'] ?? null]);

        $action = isset($data['transferred_at']) ? 'bulk_transfer' : 'bulk_transfer_clear';

        AuditLog::record($action, 'lazada_transactions_work', 0, 'bulk', [
            'transferred_at' => $data['transferred_at'] ?? null,
            'start_date'     => $data['start_date'] ?? null,
            'end_date'       => $data['end_date'] ?? null,
            'ids_count'      => count($data['ids']),
            'updated'        => $updated,
            'ids'            => $data['ids'],
        ]);

        return response()->json(['updated' => $updated]);
    }

    public function smartUndo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'                     => 'required|array|min:1',
            'ids.*'                   => 'integer',
            'original_transferred_at' => 'nullable|date',
            'new_transferred_at'      => 'nullable|date',
            'start_date'              => 'nullable|date',
            'end_date'                => 'nullable|date',
        ]);

        // เก็บเฉพาะ IDs ที่ค่า transferred_at ยังตรงกับที่ log นี้เคย set
        $q = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->whereIn('id', $data['ids']);

        if (isset($data['original_transferred_at'])) {
            $q->where('transferred_at', $data['original_transferred_at']);
        } else {
            $q->whereNull('transferred_at');
        }

        $matchingIds  = $q->pluck('id')->toArray();
        $skipped      = count($data['ids']) - count($matchingIds);
        $updated      = 0;
        $newValue     = $data['new_transferred_at'] ?? null;

        if (!empty($matchingIds)) {
            $updated = DB::connection('n8n')
                ->table('lazada_transactions_work')
                ->whereIn('id', $matchingIds)
                ->update(['transferred_at' => $newValue]);
        }

        $action = isset($data['new_transferred_at']) ? 'smart_redate' : 'smart_undo';

        AuditLog::record($action, 'lazada_transactions_work', 0, 'bulk', [
            'original_transferred_at' => $data['original_transferred_at'] ?? null,
            'transferred_at'          => $newValue,
            'start_date'              => $data['start_date'] ?? null,
            'end_date'                => $data['end_date'] ?? null,
            'ids_count'               => count($data['ids']),
            'updated'                 => $updated,
            'skipped'                 => $skipped,
            'ids'                     => $matchingIds,
        ]);

        return response()->json([
            'updated' => $updated,
            'skipped' => $skipped,
        ]);
    }

    public function ids(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->select('id');

        $this->applyFilters($q, $request);

        return response()->json(['ids' => $q->pluck('id')]);
    }

    public function index(Request $request): JsonResponse
    {
        $q = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->select([
                'id', 'shop_name', 'transaction_date', 'transaction_type',
                'fee_name', 'transaction_number', 'details', 'seller_sku', 'lazada_sku',
                'amount', 'vat_in_amount', 'wht_amount', 'wht_included_in_amount',
                'statement', 'paid_status', 'order_no', 'order_item_no', 'order_item_status',
                'shipping_provider', 'shipping_speed', 'shipment_type',
                'reference', 'comment', 'payment_ref_id', 'short_code', 'source',
                'transferred_at',
                'synced_at', 'file_id',
            ])
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        $this->applyFilters($q, $request);

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }

    private function applyFilters($q, Request $request): void
    {
        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('transaction_number', 'ilike', "%{$s}%")
                   ->orWhere('order_no', 'ilike', "%{$s}%")
                   ->orWhere('fee_name', 'ilike', "%{$s}%")
                   ->orWhere('details', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name')) {
            $q->where('shop_name', $request->shop_name);
        }

        if ($request->filled('transaction_type')) {
            $q->where('transaction_type', 'ilike', '%' . $request->transaction_type . '%');
        }

        if ($request->filled('start_date')) {
            $q->where('transaction_date', '>=', $request->start_date);
        }

        if ($request->filled('end_date')) {
            $q->where('transaction_date', '<=', $request->end_date);
        }

        if ($request->filled('paid_status')) {
            $q->where('paid_status', 'ilike', $request->paid_status);
        }

        if ($request->filled('source')) {
            $q->where('source', $request->source);
        }

        // Transfer status filter
        if ($request->filled('transfer_status')) {
            if ($request->transfer_status === 'transferred') {
                $q->whereNotNull('transferred_at');
            } elseif ($request->transfer_status === 'not_transferred') {
                $q->whereNull('transferred_at');
            }
        }

        // Transfer date range filter
        if ($request->filled('transferred_start')) {
            $q->where('transferred_at', '>=', $request->transferred_start);
        }
        if ($request->filled('transferred_end')) {
            $q->where('transferred_at', '<=', $request->transferred_end);
        }
    }
}
