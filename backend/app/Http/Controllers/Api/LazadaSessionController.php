<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LazadaSessionController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')
            ->table('lazada_session as ls')
            ->leftJoin('lazada_transaction_tokens as ltt', 'ltt.short_code', '=', 'ls.seller_key')
            ->leftJoin('master_banks as mb', 'mb.id', '=', 'ltt.bank_id')
            ->whereNull('ltt.deleted_at')
            ->select([
                'ls.*',
                'ltt.shop_name',
                'ltt.bank_account_name',
                'ltt.bank_account_number',
                'mb.bank_name_th',
            ]);
    }

    private function find(int $id)
    {
        return DB::connection('n8n')
            ->table('lazada_session as ls')
            ->leftJoin('lazada_transaction_tokens as ltt', 'ltt.short_code', '=', 'ls.seller_key')
            ->leftJoin('master_banks as mb', 'mb.id', '=', 'ltt.bank_id')
            ->whereNull('ltt.deleted_at')
            ->select([
                'ls.*',
                'ltt.shop_name',
                'ltt.bank_account_name',
                'ltt.bank_account_number',
                'mb.bank_name_th',
            ])
            ->where('ls.id', $id)
            ->first();
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('ls.seller_key');

        if ($request->filled('search')) {
            $q->where(function ($qb) use ($request) {
                $qb->where('ls.seller_key', 'ilike', '%' . $request->search . '%')
                   ->orWhere('ltt.shop_name', 'ilike', '%' . $request->search . '%');
            });
        }

        $sessions = $q->get()->map(fn($s) => $this->withStatus($s));

        return response()->json([
            'data'  => $sessions,
            'total' => $sessions->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'seller_key' => 'required|string|max:50',
            'cookie'     => 'required|string',
        ]);

        $exists = DB::connection('n8n')->table('lazada_session')->where('seller_key', $data['seller_key'])->first();
        if ($exists) {
            return response()->json(['message' => 'seller_key นี้มีอยู่แล้ว กรุณาแก้ไขแทนการเพิ่มใหม่'], 422);
        }

        $id = DB::connection('n8n')->table('lazada_session')->insertGetId([
            'seller_key' => $data['seller_key'],
            'cookie'     => $data['cookie'],
            'updated_at' => now(),
        ]);

        AuditLog::record('create', 'lazada_session', $id, $data['seller_key'], [
            'cookie_length' => strlen($data['cookie']),
        ]);

        return response()->json($this->withStatus($this->find($id)), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $session = $this->find($id);
        if (! $session) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $data = $request->validate([
            'seller_key' => 'sometimes|string|max:50',
            'cookie'     => 'sometimes|string',
        ]);

        if (isset($data['seller_key']) && $data['seller_key'] !== $session->seller_key) {
            $exists = DB::connection('n8n')->table('lazada_session')->where('seller_key', $data['seller_key'])->first();
            if ($exists) {
                return response()->json(['message' => 'seller_key นี้มีอยู่แล้ว'], 422);
            }
        }

        $data['updated_at'] = now();
        DB::connection('n8n')->table('lazada_session')->where('id', $id)->update($data);

        AuditLog::record('update', 'lazada_session', $id, $session->seller_key, array_filter([
            'seller_key'    => $data['seller_key'] ?? null,
            'cookie_length' => isset($data['cookie']) ? strlen($data['cookie']) : null,
        ]));

        return response()->json($this->withStatus($this->find($id)));
    }

    public function destroy(int $id): JsonResponse
    {
        $session = $this->find($id);
        if (! $session) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        DB::connection('n8n')->table('lazada_session')->where('id', $id)->delete();

        AuditLog::record('delete', 'lazada_session', $id, $session->seller_key);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function shopKeys(): JsonResponse
    {
        $keys = DB::connection('n8n')
            ->table('lazada_transaction_tokens')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->whereNotNull('short_code')
            ->where('short_code', '!=', '')
            ->orderBy('short_code')
            ->pluck('short_code', 'shop_name');

        return response()->json($keys);
    }

    private function withStatus(object $session): array
    {
        $updatedAt = $session->updated_at ? new \DateTime($session->updated_at) : null;
        $daysAgo   = $updatedAt ? (int) $updatedAt->diff(new \DateTime())->days : null;

        $status = match (true) {
            $daysAgo === null    => 'unknown',
            $daysAgo <= 7        => 'active',
            $daysAgo <= 14       => 'warning',
            default              => 'expired',
        };

        return [
            'id'                  => $session->id,
            'seller_key'          => $session->seller_key,
            'shop_name'           => $session->shop_name ?? null,
            'cookie_length'       => strlen($session->cookie ?? ''),
            'cookie_preview'      => $session->cookie ? substr($session->cookie, 0, 30) . '...' : null,
            'updated_at'          => $session->updated_at,
            'days_ago'            => $daysAgo,
            'status'              => $status,
            'bank_name_th'        => $session->bank_name_th ?? null,
            'bank_account_name'   => $session->bank_account_name ?? null,
            'bank_account_number' => $session->bank_account_number ?? null,
        ];
    }
}
