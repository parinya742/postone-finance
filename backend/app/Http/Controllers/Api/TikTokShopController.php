<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class TikTokShopController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')->table('tiktok_transaction_tokens');
    }

    private function find(int $id)
    {
        return DB::connection('n8n')->table('tiktok_transaction_tokens')->where('id', $id)->first();
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('seller_name');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('seller_name', 'ilike', "%{$s}%")
                   ->orWhere('seller_id', 'ilike', "%{$s}%")
                   ->orWhere('shops_code', 'ilike', "%{$s}%");
            });
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'seller_name' => 'required|string|max:255',
            'seller_id'   => 'nullable|string|max:255',
            'shops_code'  => 'nullable|string|max:255',
        ]);

        $id = $this->query()->insertGetId([
            'seller_name'   => $data['seller_name'],
            'seller_id'     => $data['seller_id'] ?? '',
            'shops_code'    => $data['shops_code'] ?? null,
            'access_token'  => '',
            'refresh_token' => '',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        AuditLog::record('create', 'tiktok_shop', $id, $data['seller_name'], [
            'seller_id'  => $data['seller_id'] ?? null,
            'shops_code' => $data['shops_code'] ?? null,
        ]);

        return response()->json($this->find($id), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $shop = $this->find($id);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $data = $request->validate([
            'seller_name'   => 'sometimes|string|max:255',
            'seller_id'     => 'sometimes|string|max:255',
            'shops_code'    => 'sometimes|nullable|string|max:255',
            'access_token'  => 'nullable|string',
            'refresh_token' => 'nullable|string',
        ]);

        $data['updated_at'] = now();
        $this->query()->where('id', $id)->update($data);

        $logPayload = array_filter($data, fn($k) => !in_array($k, ['access_token', 'refresh_token', 'updated_at']), ARRAY_FILTER_USE_KEY);
        AuditLog::record('update', 'tiktok_shop', $id, $shop->seller_name, $logPayload);

        return response()->json($this->find($id));
    }

    public function destroy(int $id): JsonResponse
    {
        $shop = $this->find($id);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $this->query()->where('id', $id)->delete();

        AuditLog::record('delete', 'tiktok_shop', $id, $shop->seller_name);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function authConfig(): JsonResponse
    {
        return response()->json(['app_key' => env('TIKTOK_APP_KEY')]);
    }

    public function getAuthUrl(int $id): JsonResponse
    {
        $shop = $this->find($id);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }

        $url = 'https://auth.tiktok-shops.com/oauth/authorize?' . http_build_query([
            'app_key' => env('TIKTOK_APP_KEY'),
            'state'   => $id,
        ]);

        return response()->json(['url' => $url]);
    }

    public function exchangeToken(Request $request, int $id): JsonResponse
    {
        $shop = $this->find($id);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }

        $code      = $request->validate(['code' => 'required|string'])['code'];
        $appKey    = env('TIKTOK_APP_KEY');
        $appSecret = env('TIKTOK_APP_SECRET');
        $timestamp = (int) now()->timestamp;

        $params = [
            'app_key'      => $appKey,
            'app_secret'   => $appSecret,
            'auth_code'    => $code,
            'grant_type'   => 'authorized_code',
            'timestamp'    => $timestamp,
        ];

        $sign = $this->generateSign($params, $appSecret);
        $params['sign'] = $sign;

        $response = Http::get('https://auth.tiktok-shops.com/api/v2/token/get', $params);
        $result   = $response->json();

        if (! empty($result['data']['access_token'])) {
            $d = $result['data'];
            $updateData = [
                'access_token'              => $d['access_token'],
                'refresh_token'             => $d['refresh_token'] ?? '',
                'access_token_expires_at'   => isset($d['access_token_expire_in'])
                    ? now()->addSeconds((int) $d['access_token_expire_in'])
                    : null,
                'refresh_token_expires_at'  => isset($d['refresh_token_expire_in'])
                    ? now()->addSeconds((int) $d['refresh_token_expire_in'])
                    : null,
                'open_id'                   => $d['open_id'] ?? null,
                'granted_scopes'            => isset($d['granted_scopes'])
                    ? json_encode($d['granted_scopes'])
                    : null,
                'updated_at'                => now(),
            ];

            // Fetch shops to get cipher and code
            $shopsApiResponse = null;
            try {
                $shopsResult     = $this->callTikTokShopApi($d['access_token'], '/authorization/202309/shops');
                $shopsApiResponse = $shopsResult;

                if (! empty($shopsResult['data']['shops'])) {
                    $firstShop = $shopsResult['data']['shops'][0];
                    $updateData['shops_cipher'] = $firstShop['cipher'] ?? null;
                    $updateData['shops_code']   = $firstShop['code'] ?? null;
                    if (! empty($firstShop['id']) && empty($shop->seller_id)) {
                        $updateData['seller_id'] = $firstShop['id'];
                    }
                    if (! empty($firstShop['name'])) {
                        $updateData['seller_name'] = $firstShop['name'];
                    }
                }
            } catch (\Throwable $e) {
                $shopsApiResponse = ['exception' => $e->getMessage()];
            }

            $this->query()->where('id', $id)->update($updateData);

            AuditLog::record('exchange_token', 'tiktok_shop', $id, $updateData['seller_name'] ?? $shop->seller_name, [
                'expires_at'  => $updateData['access_token_expires_at']
                    ? (is_object($updateData['access_token_expires_at'])
                        ? $updateData['access_token_expires_at']->toDateTimeString()
                        : $updateData['access_token_expires_at'])
                    : null,
                'open_id'     => $updateData['open_id'] ?? null,
                'shops_code'  => $updateData['shops_code'] ?? null,
            ]);

            return response()->json([
                ...(array) $this->find($id),
                '_shops_api' => $shopsApiResponse,
            ]);
        }

        return response()->json([
            'message'       => 'Token exchange failed',
            'tiktok_error'  => $result,
        ], 422);
    }

    public function refreshToken(int $id): JsonResponse
    {
        $shop = $this->find($id);
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }
        if (empty($shop->refresh_token)) {
            return response()->json(['message' => 'ไม่มี Refresh Token'], 422);
        }

        $appKey    = env('TIKTOK_APP_KEY');
        $appSecret = env('TIKTOK_APP_SECRET');
        $timestamp = (int) now()->timestamp;

        $params = [
            'app_key'       => $appKey,
            'app_secret'    => $appSecret,
            'refresh_token' => $shop->refresh_token,
            'grant_type'    => 'refresh_token',
            'timestamp'     => $timestamp,
        ];

        $sign = $this->generateSign($params, $appSecret);
        $params['sign'] = $sign;

        $response = Http::get('https://auth.tiktok-shops.com/api/v2/token/refresh', $params);
        $result   = $response->json();

        if (! empty($result['data']['access_token'])) {
            $d = $result['data'];
            $updateData = [
                'access_token'             => $d['access_token'],
                'refresh_token'            => $d['refresh_token'] ?? $shop->refresh_token,
                'access_token_expires_at'  => isset($d['access_token_expire_in'])
                    ? now()->addSeconds((int) $d['access_token_expire_in'])
                    : null,
                'refresh_token_expires_at' => isset($d['refresh_token_expire_in'])
                    ? now()->addSeconds((int) $d['refresh_token_expire_in'])
                    : null,
                'updated_at'               => now(),
            ];

            $this->query()->where('id', $id)->update($updateData);

            AuditLog::record('refresh_token', 'tiktok_shop', $id, $shop->seller_name, [
                'expires_at' => $updateData['access_token_expires_at']
                    ? (is_object($updateData['access_token_expires_at'])
                        ? $updateData['access_token_expires_at']->toDateTimeString()
                        : $updateData['access_token_expires_at'])
                    : null,
            ]);

            return response()->json($this->find($id));
        }

        return response()->json([
            'message'      => 'Token refresh failed',
            'tiktok_error' => $result,
        ], 422);
    }

    public function autoRefresh(): JsonResponse
    {
        $shops = $this->query()
            ->where('access_token_expires_at', '<=', now()->addDays(7))
            ->whereNotNull('refresh_token')
            ->where('refresh_token', '!=', '')
            ->get();

        $refreshed = [];
        $failed    = [];

        foreach ($shops as $shop) {
            $res = $this->refreshToken($shop->id);
            if ($res->getStatusCode() === 200) {
                $refreshed[] = $shop->seller_name;
            } else {
                $failed[] = $shop->seller_name;
            }
        }

        return response()->json([
            'refreshed' => $refreshed,
            'failed'    => $failed,
        ]);
    }

    private function callTikTokShopApi(string $accessToken, string $path, array $extraParams = []): array
    {
        $appKey    = env('TIKTOK_APP_KEY');
        $appSecret = env('TIKTOK_APP_SECRET');
        $timestamp = (int) now()->timestamp;

        $params = array_merge([
            'app_key'   => $appKey,
            'timestamp' => $timestamp,
        ], $extraParams);

        ksort($params);
        $signStr = $appSecret . $path;
        foreach ($params as $k => $v) {
            $signStr .= $k . $v;
        }
        $signStr .= $appSecret;
        $params['sign'] = hash_hmac('sha256', $signStr, $appSecret);

        $response = Http::withHeaders([
            'x-tts-access-token' => $accessToken,
        ])->get('https://open-api.tiktokglobalshop.com' . $path, $params);

        return $response->json() ?? [];
    }

    private function generateSign(array $params, string $appSecret): string
    {
        $signParams = array_filter($params, fn($k) => !in_array($k, ['app_secret', 'sign']), ARRAY_FILTER_USE_KEY);
        ksort($signParams);

        $signStr = '';
        foreach ($signParams as $k => $v) {
            $signStr .= $k . $v;
        }

        return hash_hmac('sha256', $signStr, $appSecret);
    }
}
