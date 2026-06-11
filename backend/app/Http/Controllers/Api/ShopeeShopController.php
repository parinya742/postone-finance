<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ShopeeShopController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')->table('shopee_transaction_tokens');
    }

    private function find(string $shopId)
    {
        return DB::connection('n8n')->table('shopee_transaction_tokens')->where('shop_id', $shopId)->first();
    }

    private function makeSign(string $path): array
    {
        $partnerId  = trim((string) env('SHOPEE_PARTNER_ID', ''));
        $partnerKey = trim((string) env('SHOPEE_PARTNER_KEY', ''));
        $timestamp  = (int) now()->timestamp;
        $baseString = $partnerId . $path . $timestamp;
        $sign       = hash_hmac('sha256', $baseString, $partnerKey);

        return compact('partnerId', 'partnerKey', 'timestamp', 'sign');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('shop_name');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('shop_name', 'ilike', "%{$s}%")
                   ->orWhere('shop_id', 'ilike', "%{$s}%");
            });
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shop_name' => 'nullable|string|max:255',
        ]);

        // Use a temporary placeholder ID until the real shop_id is received from OAuth
        $tempShopId = 'PENDING_' . now()->timestamp . '_' . uniqid();

        DB::connection('n8n')->table('shopee_transaction_tokens')->insert([
            'shop_id'       => $tempShopId,
            'shop_name'     => $data['shop_name'] ?? null,
            'partner_id'    => env('SHOPEE_PARTNER_ID'),
            'partner_key'   => env('SHOPEE_PARTNER_KEY'),
            'access_token'  => '',
            'refresh_token' => '',
            'updated_at'    => now(),
        ]);

        AuditLog::record('create', 'shopee_shop', 0, $data['shop_name'] ?? $tempShopId);

        return response()->json($this->find($tempShopId), 201);
    }

    public function update(Request $request, string $shopId): JsonResponse
    {
        $shop = $this->find($shopId);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $data = $request->validate([
            'shop_name'     => 'sometimes|nullable|string|max:255',
            'access_token'  => 'sometimes|nullable|string',
            'refresh_token' => 'sometimes|nullable|string',
        ]);

        $data['updated_at'] = now();
        $this->query()->where('shop_id', $shopId)->update($data);

        $logPayload = array_filter($data, fn($k) => !in_array($k, ['access_token', 'refresh_token', 'updated_at']), ARRAY_FILTER_USE_KEY);
        AuditLog::record('update', 'shopee_shop', (int) $shopId, $shop->shop_name ?? $shopId, $logPayload);

        return response()->json($this->find($shopId));
    }

    public function destroy(string $shopId): JsonResponse
    {
        $shop = $this->find($shopId);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $this->query()->where('shop_id', $shopId)->delete();

        AuditLog::record('delete', 'shopee_shop', (int) $shopId, $shop->shop_name ?? $shopId);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function authConfig(): JsonResponse
    {
        return response()->json(['partner_id' => env('SHOPEE_PARTNER_ID')]);
    }

    public function getAuthUrl(string $shopId): JsonResponse
    {
        $shop = $this->find($shopId);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }

        $path = '/api/v2/shop/auth_partner';
        ['partnerId' => $partnerId, 'timestamp' => $timestamp, 'sign' => $sign] = $this->makeSign($path);

        $url = 'https://partner.shopeemobile.com' . $path . '?' . http_build_query([
            'partner_id' => $partnerId,
            'timestamp'  => $timestamp,
            'sign'       => $sign,
            'redirect'   => env('SHOPEE_REDIRECT_URI'),
        ]);

        return response()->json(['url' => $url]);
    }

    public function exchangeToken(Request $request, string $shopId): JsonResponse
    {
        $shop = $this->find($shopId);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }

        $code = $request->validate(['code' => 'required|string'])['code'];

        $path = '/api/v2/auth/token/get';
        ['partnerId' => $partnerId, 'timestamp' => $timestamp, 'sign' => $sign] = $this->makeSign($path);

        // Shopee API v2: auth params go in query string, payload in body
        $response = Http::post(
            'https://partner.shopeemobile.com' . $path . '?' . http_build_query([
                'partner_id' => (int) $partnerId,
                'timestamp'  => $timestamp,
                'sign'       => $sign,
            ]),
            [
                'partner_id' => (int) $partnerId,
                'code'       => $code,
            ]
        );
        $result = $response->json();

        if (! empty($result['access_token'])) {
            $realShopId    = (string) ($result['shop_id_list'][0] ?? null);
            $targetShopId  = ($realShopId && $realShopId !== '0') ? $realShopId : $shopId;

            $expireIn  = $result['expire_in'] ?? 14400;
            $tokenData = [
                'access_token'  => $result['access_token'],
                'refresh_token' => $result['refresh_token'] ?? '',
                'expires_at'    => now()->addSeconds($expireIn),
                'updated_at'    => now(),
            ];

            if ($targetShopId !== $shopId) {
                $existing = $this->find($targetShopId);
                if ($existing) {
                    // Real shop already has a record — update it and remove the pending placeholder
                    $this->query()->where('shop_id', $targetShopId)->update($tokenData);
                    $this->query()->where('shop_id', $shopId)->delete();
                } else {
                    // Promote the pending record to the real shop_id
                    $this->query()->where('shop_id', $shopId)->update(
                        array_merge($tokenData, ['shop_id' => $targetShopId])
                    );
                }
            } else {
                $this->query()->where('shop_id', $shopId)->update($tokenData);
            }

            AuditLog::record('exchange_token', 'shopee_shop', (int) $targetShopId, $shop->shop_name ?? $targetShopId, [
                'shop_id' => $targetShopId,
            ]);

            return response()->json($this->find($targetShopId));
        }

        return response()->json([
            'message'      => 'Token exchange failed',
            'shopee_error' => $result,
        ], 422);
    }

    public function refreshToken(string $shopId): JsonResponse
    {
        $shop = $this->find($shopId);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }
        if (empty($shop->refresh_token)) {
            return response()->json(['message' => 'ไม่มี Refresh Token'], 422);
        }

        $path = '/api/v2/auth/access_token/get';
        ['partnerId' => $partnerId, 'timestamp' => $timestamp, 'sign' => $sign] = $this->makeSign($path);

        $response = Http::post(
            'https://partner.shopeemobile.com' . $path . '?' . http_build_query([
                'partner_id' => (int) $partnerId,
                'timestamp'  => $timestamp,
                'sign'       => $sign,
            ]),
            [
                'partner_id'    => (int) $partnerId,
                'shop_id'       => (int) $shopId,
                'refresh_token' => $shop->refresh_token,
            ]
        );
        $result = $response->json();

        $newToken = $result['access_token'] ?? null;

        if ($newToken) {
            $expireIn = $result['expire_in'] ?? 14400;
            $this->query()->where('shop_id', $shopId)->update([
                'access_token'  => $newToken,
                'refresh_token' => $result['refresh_token'] ?? $shop->refresh_token,
                'expires_at'    => now()->addSeconds($expireIn),
                'updated_at'    => now(),
            ]);

            AuditLog::record('refresh_token', 'shopee_shop', (int) $shopId, $shop->shop_name ?? $shopId);

            return response()->json($this->find($shopId));
        }

        return response()->json([
            'message'      => 'Token refresh failed',
            'shopee_error' => $result,
        ], 422);
    }
}
