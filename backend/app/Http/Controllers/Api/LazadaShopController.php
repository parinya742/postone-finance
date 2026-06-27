<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class LazadaShopController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')
            ->table('lazada_transaction_tokens as t')
            ->leftJoin('master_banks as b', 'b.id', '=', 't.bank_id')
            ->select([
                't.*',
                'b.bank_name_th',
                'b.bank_name_en',
            ])
            ->whereNull('t.deleted_at');
    }

    private function find(int $id)
    {
        return DB::connection('n8n')
            ->table('lazada_transaction_tokens as t')
            ->leftJoin('master_banks as b', 'b.id', '=', 't.bank_id')
            ->select([
                't.*',
                'b.bank_name_th',
                'b.bank_name_en',
            ])
            ->where('t.id', $id)
            ->first();
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('t.shop_name');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('t.shop_name', 'ilike', "%{$s}%")
                   ->orWhere('t.seller_id', 'ilike', "%{$s}%")
                   ->orWhere('t.short_code', 'ilike', "%{$s}%");
            });
        }

        if ($request->filled('is_active')) {
            $q->where('t.is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shop_name'           => 'required|string|max:100',
            'seller_id'           => 'nullable|string|max:50',
            'short_code'          => 'nullable|string|max:50',
            'is_active'           => 'boolean',
            'bank_id'             => 'nullable|integer',
            'bank_account_name'   => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:50',
        ]);

        $id = DB::connection('n8n')->table('lazada_transaction_tokens')->insertGetId([
            'shop_name'          => $data['shop_name'],
            'seller_id'          => $data['seller_id'] ?? null,
            'short_code'         => $data['short_code'] ?? null,
            'is_active'          => $data['is_active'] ?? true,
            'bank_id'            => $data['bank_id'] ?? null,
            'bank_account_name'  => $data['bank_account_name'] ?? null,
            'bank_account_number'=> $data['bank_account_number'] ?? null,
            'app_key'            => env('LAZADA_APP_KEY'),
            'app_secret'         => env('LAZADA_APP_SECRET'),
            'access_token'       => '',
            'refresh_token'      => '',
        ]);

        AuditLog::record('create', 'lazada_shop', $id, $data['shop_name'], [
            'seller_id'  => $data['seller_id'] ?? null,
            'short_code' => $data['short_code'] ?? null,
            'is_active'  => $data['is_active'] ?? true,
        ]);

        return response()->json($this->find($id), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $shop = $this->query()->where('t.id', $id)->first();
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $data = $request->validate([
            'shop_name'          => 'sometimes|string|max:100',
            'seller_id'          => 'sometimes|string|max:50',
            'short_code'         => 'sometimes|string|max:50',
            'access_token'       => 'nullable|string',
            'refresh_token'      => 'nullable|string',
            'is_active'          => 'sometimes|boolean',
            'bank_id'            => 'nullable|integer',
            'bank_account_name'  => 'nullable|string|max:255',
            'bank_account_number'=> 'nullable|string|max:50',
        ]);

        $data['updated_at'] = now();
        DB::connection('n8n')->table('lazada_transaction_tokens')->where('id', $id)->update($data);

        $logPayload = array_filter($data, fn($k) => !in_array($k, ['access_token', 'refresh_token', 'updated_at']), ARRAY_FILTER_USE_KEY);
        $logPayload = array_map(fn($v) => $v === null ? null : $v, $logPayload);
        AuditLog::record('update', 'lazada_shop', $id, $shop->shop_name, $logPayload);

        return response()->json($this->find($id));
    }

    public function destroy(int $id): JsonResponse
    {
        $shop = $this->query()->where('t.id', $id)->first();
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        DB::connection('n8n')->table('lazada_transaction_tokens')->where('id', $id)->update([
            'deleted_at' => now(),
            'updated_at' => now(),
        ]);

        AuditLog::record('delete', 'lazada_shop', $id, $shop->shop_name);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function authConfig(): JsonResponse
    {
        return response()->json(['app_key' => env('LAZADA_APP_KEY')]);
    }

    public function getAuthUrl(int $id): JsonResponse
    {
        $shop = $this->query()->where('t.id', $id)->first();
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }

        $url = 'https://auth.lazada.com/oauth/authorize?' . http_build_query([
            'response_type' => 'code',
            'force_auth'    => 'true',
            'redirect_uri'  => env('LAZADA_REDIRECT_URI'),
            'client_id'     => env('LAZADA_APP_KEY'),
            'state'         => $id,
        ]);

        return response()->json(['url' => $url]);
    }

    public function exchangeToken(Request $request, int $id): JsonResponse
    {
        $shop = $this->query()->where('t.id', $id)->first();
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }

        $code      = $request->validate(['code' => 'required|string'])['code'];
        $appKey    = env('LAZADA_APP_KEY');
        $appSecret = env('LAZADA_APP_SECRET');
        $path      = '/auth/token/create';
        $timestamp = (int) (microtime(true) * 1000);

        $params = [
            'app_key'     => $appKey,
            'code'        => $code,
            'grant_type'  => 'authorization_code',
            'sign_method' => 'sha256',
            'timestamp'   => $timestamp,
        ];
        ksort($params);

        $signStr = $path;
        foreach ($params as $k => $v) {
            $signStr .= $k . $v;
        }
        $sign = strtoupper(hash_hmac('sha256', $signStr, $appSecret));

        $response = Http::get('https://auth.lazada.com/rest' . $path, array_merge($params, ['sign' => $sign]));
        $result   = $response->json();

        if (! empty($result['access_token'])) {
            $expiresIn  = (int) ($result['expires_in'] ?? 2592000);
            $updateData = [
                'access_token'            => $result['access_token'],
                'refresh_token'           => $result['refresh_token'] ?? '',
                'access_token_expires_at' => now()->addSeconds($expiresIn),
                'updated_at'              => now(),
            ];

            $sellerInfo = $this->callLazadaApi($result['access_token'], '/seller/get');
            if (! empty($sellerInfo['data'])) {
                $d = $sellerInfo['data'];
                if (! empty($d['seller_id'])) {
                    $updateData['seller_id'] = (string) $d['seller_id'];
                }
                if (! empty($d['short_code'])) {
                    $updateData['short_code'] = $d['short_code'];
                }
            }

            DB::connection('n8n')->table('lazada_transaction_tokens')->where('id', $id)->update($updateData);

            AuditLog::record('exchange_token', 'lazada_shop', $id, $shop->shop_name, [
                'expires_at' => now()->addSeconds($expiresIn)->toDateTimeString(),
                'seller_id'  => $updateData['seller_id'] ?? null,
                'short_code' => $updateData['short_code'] ?? null,
            ]);

            return response()->json($this->find($id));
        }

        return response()->json([
            'message'      => 'Token exchange failed',
            'lazada_error' => $result,
        ], 422);
    }

    public function refreshToken(int $id): JsonResponse
    {
        $shop = $this->query()->where('t.id', $id)->first();
        if (! $shop) {
            return response()->json(['message' => 'ไม่พบร้านค้า'], 404);
        }
        if (empty($shop->refresh_token)) {
            return response()->json(['message' => 'ไม่มี Refresh Token'], 422);
        }

        $appKey    = env('LAZADA_APP_KEY');
        $appSecret = env('LAZADA_APP_SECRET');
        $path      = '/auth/token/refresh';
        $timestamp = (int) (microtime(true) * 1000);

        $params = [
            'app_key'       => $appKey,
            'refresh_token' => $shop->refresh_token,
            'sign_method'   => 'sha256',
            'timestamp'     => $timestamp,
        ];
        ksort($params);

        $signStr = $path;
        foreach ($params as $k => $v) {
            $signStr .= $k . $v;
        }
        $sign = strtoupper(hash_hmac('sha256', $signStr, $appSecret));

        $response = Http::get('https://auth.lazada.com/rest' . $path, array_merge($params, ['sign' => $sign]));
        $result   = $response->json();

        if (! empty($result['access_token'])) {
            $expiresIn = (int) ($result['expires_in'] ?? 2592000);
            DB::connection('n8n')->table('lazada_transaction_tokens')->where('id', $id)->update([
                'access_token'            => $result['access_token'],
                'refresh_token'           => $result['refresh_token'] ?? $shop->refresh_token,
                'access_token_expires_at' => now()->addSeconds($expiresIn),
                'updated_at'              => now(),
            ]);

            AuditLog::record('refresh_token', 'lazada_shop', $id, $shop->shop_name, [
                'expires_at' => now()->addSeconds($expiresIn)->toDateTimeString(),
            ]);

            return response()->json($this->find($id));
        }

        return response()->json([
            'message'      => 'Token refresh failed',
            'lazada_error' => $result,
        ], 422);
    }

    public function autoRefresh(): JsonResponse
    {
        $shops = $this->query()
            ->where('t.is_active', true)
            ->where('t.access_token_expires_at', '<=', now()->addDays(7))
            ->whereNotNull('t.refresh_token')
            ->where('t.refresh_token', '!=', '')
            ->get();

        $refreshed = [];
        $failed    = [];

        foreach ($shops as $shop) {
            $res = $this->refreshToken($shop->id);
            if ($res->getStatusCode() === 200) {
                $refreshed[] = $shop->shop_name;
            } else {
                $failed[] = $shop->shop_name;
            }
        }

        return response()->json([
            'refreshed' => $refreshed,
            'failed'    => $failed,
        ]);
    }

    private function callLazadaApi(string $accessToken, string $path, array $extraParams = []): array
    {
        $appKey    = env('LAZADA_APP_KEY');
        $appSecret = env('LAZADA_APP_SECRET');
        $timestamp = (int) (microtime(true) * 1000);

        $params = array_merge([
            'app_key'      => $appKey,
            'access_token' => $accessToken,
            'sign_method'  => 'sha256',
            'timestamp'    => $timestamp,
        ], $extraParams);
        ksort($params);

        $signStr = $path;
        foreach ($params as $k => $v) {
            $signStr .= $k . $v;
        }
        $sign = strtoupper(hash_hmac('sha256', $signStr, $appSecret));

        $response = Http::get('https://api.lazada.co.th/rest' . $path, array_merge($params, ['sign' => $sign]));
        return $response->json() ?? [];
    }
}
