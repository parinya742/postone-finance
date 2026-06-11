<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RefreshShopeeTokens extends Command
{
    protected $signature   = 'shopee:refresh-tokens';
    protected $description = 'Refresh Shopee access tokens that are expiring within 2 hours';

    public function handle(): int
    {
        $partnerId  = trim((string) env('SHOPEE_PARTNER_ID', ''));
        $partnerKey = trim((string) env('SHOPEE_PARTNER_KEY', ''));

        if (! $partnerId || ! $partnerKey) {
            $this->error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not configured.');
            return self::FAILURE;
        }

        $shops = DB::connection('n8n')
            ->table('shopee_transaction_tokens')
            ->whereNotNull('refresh_token')
            ->where('refresh_token', '!=', '')
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '<=', now()->addHours(2));
            })
            ->where('shop_id', 'not like', 'PENDING_%')
            ->get();

        if ($shops->isEmpty()) {
            $this->info('No tokens need refreshing.');
            return self::SUCCESS;
        }

        $this->info("Found {$shops->count()} shop(s) to refresh.");

        $path       = '/api/v2/auth/access_token/get';
        $timestamp  = (int) now()->timestamp;
        $sign       = hash_hmac('sha256', $partnerId . $path . $timestamp, $partnerKey);

        foreach ($shops as $shop) {
            $this->line("  Refreshing: {$shop->shop_name} ({$shop->shop_id})");

            try {
                $response = Http::post(
                    'https://partner.shopeemobile.com' . $path . '?' . http_build_query([
                        'partner_id' => (int) $partnerId,
                        'timestamp'  => $timestamp,
                        'sign'       => $sign,
                    ]),
                    [
                        'partner_id'    => (int) $partnerId,
                        'shop_id'       => (int) $shop->shop_id,
                        'refresh_token' => $shop->refresh_token,
                    ]
                );

                $result = $response->json();

                if (! empty($result['access_token'])) {
                    $expireIn  = $result['expire_in'] ?? 14400;
                    $expiresAt = now()->addSeconds($expireIn);

                    DB::connection('n8n')
                        ->table('shopee_transaction_tokens')
                        ->where('shop_id', $shop->shop_id)
                        ->update([
                            'access_token'  => $result['access_token'],
                            'refresh_token' => $result['refresh_token'] ?? $shop->refresh_token,
                            'expires_at'    => $expiresAt,
                            'updated_at'    => now(),
                        ]);

                    $this->info("    OK — expires at {$expiresAt->toDateTimeString()}");
                } else {
                    $this->warn('    FAILED: ' . json_encode($result));
                    Log::warning('shopee:refresh-tokens failed', [
                        'shop_id'  => $shop->shop_id,
                        'response' => $result,
                    ]);
                }
            } catch (\Throwable $e) {
                $this->error("    Exception: {$e->getMessage()}");
                Log::error('shopee:refresh-tokens exception', [
                    'shop_id' => $shop->shop_id,
                    'error'   => $e->getMessage(),
                ]);
            }
        }

        return self::SUCCESS;
    }
}
