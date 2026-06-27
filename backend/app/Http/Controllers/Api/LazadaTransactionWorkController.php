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
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'transferred_at' => 'nullable|date',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $updated = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->whereIn('id', $data['ids'])
            ->update(['transferred_at' => $data['transferred_at'] ?? null]);

        $action = isset($data['transferred_at']) ? 'bulk_transfer' : 'bulk_transfer_clear';

        AuditLog::record($action, 'lazada_transactions_work', 0, 'bulk', [
            'transferred_at' => $data['transferred_at'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'ids_count' => count($data['ids']),
            'updated' => $updated,
            'ids' => $data['ids'],
        ]);

        return response()->json(['updated' => $updated]);
    }

    public function smartUndo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'original_transferred_at' => 'nullable|date',
            'new_transferred_at' => 'nullable|date',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $q = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->whereIn('id', $data['ids']);

        if (isset($data['original_transferred_at'])) {
            $q->where('transferred_at', $data['original_transferred_at']);
        } else {
            $q->whereNull('transferred_at');
        }

        $matchingIds = $q->pluck('id')->toArray();
        $skipped = count($data['ids']) - count($matchingIds);
        $updated = 0;
        $newValue = $data['new_transferred_at'] ?? null;

        if (!empty($matchingIds)) {
            $updated = DB::connection('n8n')
                ->table('lazada_transactions_work')
                ->whereIn('id', $matchingIds)
                ->update(['transferred_at' => $newValue]);
        }

        $action = isset($data['new_transferred_at']) ? 'smart_redate' : 'smart_undo';

        AuditLog::record($action, 'lazada_transactions_work', 0, 'bulk', [
            'original_transferred_at' => $data['original_transferred_at'] ?? null,
            'transferred_at' => $newValue,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'ids_count' => count($data['ids']),
            'updated' => $updated,
            'skipped' => $skipped,
            'ids' => $matchingIds,
        ]);

        return response()->json(['updated' => $updated, 'skipped' => $skipped]);
    }

    public function syncCustomers(Request $request): JsonResponse
    {
        $data = $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'shop_name' => 'nullable|string',
            'force' => 'boolean',
        ]);

        $force = !empty($data['force']);

        $q = DB::connection('n8n')
            ->table('lazada_transactions_work')
            ->whereNotNull('order_no')
            ->where('order_no', '!=', '');

        if (!$force) {
            $q->where(function ($qb) {
                $qb->whereNull('cust_code')->orWhereNull('docuno');
            });
        }
        if (!empty($data['start_date']))
            $q->where('transaction_date', '>=', $data['start_date']);
        if (!empty($data['end_date']))
            $q->where('transaction_date', '<=', $data['end_date']);
        if (!empty($data['shop_name']))
            $q->where('shop_name', $data['shop_name']);

        $orderNos = $q->distinct()->pluck('order_no')->toArray();

        $custUpdated = 0;
        $docUpdated = 0;
        $custFound = 0;
        $docFound = 0;

        foreach (array_chunk($orderNos, 200) as $chunk) {
            // ── wins_681: CustCode + Custbillname ────────────────────────────
            try {
                $custMap = [];
                DB::connection('wins_681')
                    ->table('SOInvHD as hd')
                    ->leftJoin('EMCust as ec', 'hd.CustID', '=', 'ec.CustID')
                    ->select('hd.CustPONo', 'CustCode', 'ec.Custbillname')
                    ->whereIn('hd.CustPONo', $chunk)
                    ->get()
                    ->each(function ($row) use (&$custMap) {
                        $custMap[$row->CustPONo] ??= [
                            'cust_code' => $row->CustCode,
                            'cust_billname' => $row->Custbillname,
                        ];
                    });

                $custFound += count($custMap);
                foreach ($custMap as $orderNo => $cust) {
                    $custUpdated += DB::connection('n8n')
                        ->table('lazada_transactions_work')
                        ->where('order_no', $orderNo)
                        ->update([
                            'cust_code' => $cust['cust_code'],
                            'cust_billname' => $cust['cust_billname'],
                        ]);
                }
            } catch (\Throwable) {
                return response()->json(['error' => 'ไม่สามารถเชื่อมต่อ WINS_681 ได้'], 503);
            }

            // ── wins_682: Docuno + Docudate ───────────────────────────────────
            try {
                $docMap = [];
                DB::connection('wins_682')
                    ->table('SOInvHD')
                    ->select('CustPONo', 'Docuno', 'Docudate')
                    ->whereIn('CustPONo', $chunk)
                    ->get()
                    ->each(function ($row) use (&$docMap) {
                        $docMap[$row->CustPONo] ??= [
                            'docuno' => $row->Docuno,
                            'docudate' => $row->Docudate
                                ? substr((string) $row->Docudate, 0, 10)
                                : null,
                        ];
                    });

                $docFound += count($docMap);
                foreach ($docMap as $orderNo => $doc) {
                    $docUpdated += DB::connection('n8n')
                        ->table('lazada_transactions_work')
                        ->where('order_no', $orderNo)
                        ->update([
                            'docuno' => $doc['docuno'],
                            'docudate' => $doc['docudate'],
                        ]);
                }
            } catch (\Throwable) {
                return response()->json(['error' => 'ไม่สามารถเชื่อมต่อ WINS_682 ได้'], 503);
            }
        }

        AuditLog::record('sync_customers', 'lazada_transactions_work', 0, 'sync', [
            'orders_checked' => count($orderNos),
            'cust_found' => $custFound,
            'cust_rows' => $custUpdated,
            'doc_found' => $docFound,
            'doc_rows' => $docUpdated,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'shop_name' => $data['shop_name'] ?? null,
            'force' => $force,
        ]);

        return response()->json([
            'orders_checked' => count($orderNos),
            'cust_found' => $custFound,
            'cust_rows' => $custUpdated,
            'doc_found' => $docFound,
            'doc_rows' => $docUpdated,
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
                'id',
                'shop_name',
                'transaction_date',
                'transaction_type',
                'fee_name',
                'transaction_number',
                'details',
                'seller_sku',
                'lazada_sku',
                'amount',
                'vat_in_amount',
                'wht_amount',
                'wht_included_in_amount',
                'statement',
                'paid_status',
                'order_no',
                'cust_code',
                'cust_billname',
                'docuno',
                'docudate',
                'order_item_no',
                'order_item_status',
                'shipping_provider',
                'shipping_speed',
                'shipment_type',
                'reference',
                'comment',
                'payment_ref_id',
                'short_code',
                'source',
                'transferred_at',
                'synced_at',
                'file_id',
            ])
            ->orderByDesc('transaction_date')
            ->orderByDesc('id');

        $this->applyFilters($q, $request);

        $paginated = $q->paginate($request->integer('per_page', 50));
        $result = $paginated->toArray();
        $result['data'] = $this->enrichWithWins($result['data'], $request->di_status);

        $lastSync = AuditLog::where('action', 'sync_customers')
            ->where('target_type', 'lazada_transactions_work')
            ->latest('id')
            ->first();
        $result['last_sync_at'] = $lastSync ? \Carbon\Carbon::parse($lastSync->created_at)->format('Y-m-d\TH:i:s') : null;

        return response()->json($result);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function enrichWithWins(array $items, ?string $diStatus = null): array
    {
        $needsCust = collect($items)->filter(
            fn($i) => empty($i->cust_code) && !empty($i->order_no)
        );
        // Skip doc enrichment when filtering no_di — items passed the filter because
        // docuno is NULL; enriching would write docuno back and corrupt the filtered view.
        $needsDoc = ($diStatus === 'no_di')
            ? collect()
            : collect($items)->filter(fn($i) => empty($i->docuno) && !empty($i->order_no));

        if ($needsCust->isEmpty() && $needsDoc->isEmpty()) {
            return collect($items)->values()->toArray();
        }

        // ── wins_681: CustCode + Custbillname ────────────────────────────────
        if ($needsCust->isNotEmpty()) {
            $orderNos = $needsCust->pluck('order_no')->unique()->values()->toArray();
            $custMap = [];
            try {
                foreach (array_chunk($orderNos, 200) as $chunk) {
                    DB::connection('wins_681')
                        ->table('SOInvHD as hd')
                        ->leftJoin('EMCust as ec', 'hd.CustID', '=', 'ec.CustID')
                        ->select('hd.CustPONo', 'CustCode', 'ec.Custbillname')
                        ->whereIn('hd.CustPONo', $chunk)
                        ->get()
                        ->each(function ($row) use (&$custMap) {
                            $custMap[$row->CustPONo] ??= [
                                'cust_code' => $row->CustCode,
                                'cust_billname' => $row->Custbillname,
                            ];
                        });
                }
                foreach ($custMap as $orderNo => $cust) {
                    DB::connection('n8n')
                        ->table('lazada_transactions_work')
                        ->where('order_no', $orderNo)
                        ->where(function ($q) {
                            $q->whereNull('cust_code')->orWhere('cust_code', '');
                        })
                        ->update(['cust_code' => $cust['cust_code'], 'cust_billname' => $cust['cust_billname']]);
                }
                foreach ($items as $item) {
                    if (empty($item->cust_code) && isset($custMap[$item->order_no ?? ''])) {
                        $item->cust_code = $custMap[$item->order_no]['cust_code'];
                        $item->cust_billname = $custMap[$item->order_no]['cust_billname'];
                    }
                }
            } catch (\Throwable) {
            }
        }

        // ── wins_682: Docuno + Docudate ───────────────────────────────────────
        if ($needsDoc->isNotEmpty()) {
            $orderNos = $needsDoc->pluck('order_no')->unique()->values()->toArray();
            $docMap = [];
            try {
                foreach (array_chunk($orderNos, 200) as $chunk) {
                    DB::connection('wins_682')
                        ->table('SOInvHD')
                        ->select('CustPONo', 'Docuno', 'Docudate')
                        ->whereIn('CustPONo', $chunk)
                        ->get()
                        ->each(function ($row) use (&$docMap) {
                            $docMap[$row->CustPONo] ??= [
                                'docuno' => $row->Docuno,
                                'docudate' => $row->Docudate
                                    ? substr((string) $row->Docudate, 0, 10)
                                    : null,
                            ];
                        });
                }
                foreach ($docMap as $orderNo => $doc) {
                    DB::connection('n8n')
                        ->table('lazada_transactions_work')
                        ->where('order_no', $orderNo)
                        ->where(function ($q) {
                            $q->whereNull('docuno')->orWhere('docuno', '');
                        })
                        ->update(['docuno' => $doc['docuno'], 'docudate' => $doc['docudate']]);
                }
                foreach ($items as $item) {
                    if (empty($item->docuno) && isset($docMap[$item->order_no ?? ''])) {
                        $item->docuno = $docMap[$item->order_no]['docuno'];
                        $item->docudate = $docMap[$item->order_no]['docudate'];
                    }
                }
            } catch (\Throwable) {
            }
        }

        return collect($items)->values()->toArray();
    }

    private function applyFilters($q, Request $request): void
    {
        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb
                    ->where('transaction_number', 'ilike', "%{$s}%")
                    ->orWhere('order_no', 'ilike', "%{$s}%")
                    ->orWhere('fee_name', 'ilike', "%{$s}%")
                    ->orWhere('docuno', 'ilike', "%{$s}%")
                    ->orWhere('details', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('shop_name'))
            $q->where('shop_name', $request->shop_name);
        if ($request->filled('transaction_type'))
            $q->where('transaction_type', 'ilike', '%' . $request->transaction_type . '%');
        if ($request->filled('start_date'))
            $q->where('transaction_date', '>=', $request->start_date);
        if ($request->filled('end_date'))
            $q->where('transaction_date', '<=', $request->end_date);
        if ($request->filled('paid_status'))
            $q->where('paid_status', 'ilike', $request->paid_status);
        if ($request->filled('source'))
            $q->where('source', $request->source);

        if ($request->filled('transfer_status')) {
            if ($request->transfer_status === 'transferred')
                $q->whereNotNull('transferred_at');
            elseif ($request->transfer_status === 'not_transferred')
                $q->whereNull('transferred_at');
        }

        if ($request->filled('transferred_start'))
            $q->where('transferred_at', '>=', $request->transferred_start);
        if ($request->filled('transferred_end'))
            $q->where('transferred_at', '<=', $request->transferred_end);

        // DI status filter
        if ($request->filled('di_status')) {
            if ($request->di_status === 'no_di') {
                $q->where(function ($qb) {
                    $qb->whereNull('docuno')->orWhere('docuno', '');
                });
            } elseif ($request->di_status === 'has_di') {
                $q->whereNotNull('docuno')->where('docuno', '!=', '');
            }
        }
    }
}
