<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ShopeeSessionController extends Controller
{
    private function baseQuery()
    {
        return DB::connection('n8n')
            ->table('shopee_session as ss')
            ->leftJoin('shopee_transaction_tokens as stt', 'stt.shop_id', '=', 'ss.seller_key')
            ->select(
                'ss.id', 'ss.seller_key', 'ss.cookie', 'ss.updated_at',
                DB::raw("COALESCE(stt.shop_name, ss.shop_name) as shop_name")
            );
    }

    private function find(int $id): ?object
    {
        return $this->baseQuery()->where('ss.id', $id)->first();
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->baseQuery()->orderBy('ss.seller_key');

        if ($request->filled('search')) {
            $q->where(function ($qb) use ($request) {
                $qb->where('ss.seller_key', 'ilike', '%' . $request->search . '%')
                   ->orWhere('stt.shop_name', 'ilike', '%' . $request->search . '%')
                   ->orWhere('ss.shop_name', 'ilike', '%' . $request->search . '%');
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

        $exists = DB::connection('n8n')->table('shopee_session')
            ->where('seller_key', $data['seller_key'])->first();
        if ($exists) {
            return response()->json(['message' => 'seller_key นี้มีอยู่แล้ว กรุณาแก้ไขแทนการเพิ่มใหม่'], 422);
        }

        $id = DB::connection('n8n')->table('shopee_session')->insertGetId([
            'seller_key' => $data['seller_key'],
            'cookie'     => $data['cookie'],
            'updated_at' => now(),
        ]);

        AuditLog::record('create', 'shopee_session', $id, $data['seller_key'], [
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
            $exists = DB::connection('n8n')->table('shopee_session')
                ->where('seller_key', $data['seller_key'])->first();
            if ($exists) {
                return response()->json(['message' => 'seller_key นี้มีอยู่แล้ว'], 422);
            }
        }

        $data['updated_at'] = now();
        DB::connection('n8n')->table('shopee_session')->where('id', $id)->update($data);

        AuditLog::record('update', 'shopee_session', $id, $session->seller_key, array_filter([
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

        DB::connection('n8n')->table('shopee_session')->where('id', $id)->delete();

        AuditLog::record('delete', 'shopee_session', $id, $session->seller_key);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function triggerCapture(Request $request, int $id): JsonResponse
    {
        $session = $this->find($id);
        if (! $session) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $url   = env('SHOPEE_REFRESH_URL');
        $token = env('SHOPEE_REFRESH_TOKEN', '');

        if (! $url) {
            return response()->json(['message' => 'SHOPEE_REFRESH_URL ยังไม่ได้ตั้งค่าใน .env'], 500);
        }

        $manual = $request->boolean('manual', false);

        try {
            $response = Http::withHeaders(['x-refresh-token' => $token])
                ->timeout(360)
                ->post($url, [
                    'shops'  => [$session->seller_key],
                    'manual' => $manual,
                ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'เชื่อมต่อ Capture Service ไม่ได้: ' . $e->getMessage()], 503);
        }

        if ($response->status() === 409) {
            return response()->json(['message' => 'Capture กำลังทำงานอยู่ กรุณารอสักครู่'], 409);
        }

        if ($response->failed()) {
            return response()->json([
                'message' => 'Capture Service ตอบกลับ error',
                'detail'  => $response->json(),
            ], $response->status());
        }

        return response()->json([
            'capture' => $response->json(),
            'session' => $this->withStatus($this->find($id)),
        ]);
    }

    public function shopKeys(): JsonResponse
    {
        $keys = DB::connection('n8n')
            ->table('shopee_transaction_tokens')
            ->whereNotNull('shop_name')
            ->where('shop_name', '!=', '')
            ->whereNotNull('shop_id')
            ->where('shop_id', '!=', '')
            ->orderBy('shop_name')
            ->pluck('shop_id', 'shop_name');

        return response()->json($keys);
    }

    private function withStatus(object $session): array
    {
        $updatedAt = $session->updated_at ? new \DateTime($session->updated_at) : null;
        $daysAgo   = $updatedAt ? (int) $updatedAt->diff(new \DateTime())->days : null;

        $status = match (true) {
            $daysAgo === null => 'unknown',
            $daysAgo <= 7     => 'active',
            $daysAgo <= 14    => 'warning',
            default           => 'expired',
        };

        return [
            'id'             => $session->id,
            'seller_key'     => $session->seller_key,
            'shop_name'      => $session->shop_name ?? null,
            'cookie_length'  => strlen($session->cookie ?? ''),
            'cookie_preview' => $session->cookie ? substr($session->cookie, 0, 30) . '...' : null,
            'updated_at'     => $session->updated_at,
            'days_ago'       => $daysAgo,
            'status'         => $status,
        ];
    }
}
