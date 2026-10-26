<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            'users'         => ['view', 'create', 'edit', 'delete', 'export'],
            'roles'         => ['view', 'create', 'edit', 'delete'],
            'permissions'   => ['view', 'create', 'edit', 'delete'],
            'finance'       => ['view', 'create', 'edit', 'delete', 'export', 'approve'],
            'reports'       => ['view', 'export'],
            'settings'      => ['view', 'edit'],
            'audit_logs'    => ['view', 'export'],
            'dashboard'     => ['view'],
            'account-types' => ['view', 'create', 'edit', 'delete'],
            'sessions'      => ['view', 'delete'],
            'shipments'     => ['view'],
            'line-files'    => ['view', 'create', 'edit', 'delete'],
            'line-media'    => ['view', 'import', 'delete'],
            'thaipost'      => ['view'],
            'iscode'        => ['view'],
            'line-so'       => ['view'],
            'special-zones' => ['view', 'create', 'edit', 'delete'],
            'ems-rates'     => ['view', 'create', 'edit', 'delete'],
            'domestic-letter-rates' => ['view', 'create', 'edit', 'delete'],

            // === E-Commerce — Lazada ===
            'lazada-shops'             => ['view', 'create', 'edit', 'delete'],
            'lazada-sessions'          => ['view', 'create', 'edit', 'delete'],
            'lazada-transactions'      => ['view'],
            'lazada-transactions-work' => ['view', 'edit'],
            'lazada-files'             => ['view'],
            'lazada-promotion'         => ['view'],
            'lazada-promotion-files'   => ['view'],
            'lazada-invoices'          => ['view'],

            // === E-Commerce — TikTok ===
            'tiktok-shops'        => ['view', 'create', 'edit', 'delete'],
            'tiktok-transactions' => ['view'],
            'tiktok-files'        => ['view'],
            'tiktok-orders'       => ['view'],
            'tiktok-order-files'  => ['view'],
            'tiktok-tax-invoices' => ['view'],

            // === E-Commerce — Shopee ===
            'shopee-shops'               => ['view', 'create', 'edit', 'delete'],
            'shopee-sessions'            => ['view', 'create', 'edit', 'delete'],
            'shopee-transactions'        => ['view'],
            'shopee-files'               => ['view'],
            'shopee-orders'              => ['view'],
            'shopee-order-files'         => ['view'],
            'shopee-wallet-transactions' => ['view'],
            'shopee-wallet-files'        => ['view'],
            'shopee-etax'                => ['view'],
            'shopee-ads'                 => ['view'],
            'shopee-sync-logs'           => ['view'],

            // === MT — CRC ===
            'crc-price-compensate' => ['view'],
            'crc-remittance'       => ['view'],
            'crc-summary-report'   => ['view'],

            // === MT — HP-MH ===
            'hpmh-correspondence' => ['view'],
            'hpmh-coupons'        => ['view'],
            'hpmh-leaflets'       => ['view'],
            'hpmh-compensate'     => ['view'],
            'hpmh-sales-export'   => ['view'],
            'hpmh-pas'            => ['view'],
            'hpmh-receipts'       => ['view'],
        ];

        $labelMap = [
            'view'    => 'View',
            'create'  => 'Create',
            'edit'    => 'Edit',
            'delete'  => 'Delete',
            'export'  => 'Export',
            'approve' => 'Approve',
            'import'  => 'Import',
        ];

        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                $moduleLabel = ucwords(str_replace(['_', '-'], ' ', $module));
                Permission::firstOrCreate(
                    ['slug' => "{$module}.{$action}"],
                    [
                        'name'        => "{$labelMap[$action]} {$moduleLabel}",
                        'description' => "Can {$action} {$moduleLabel}",
                        'module'      => $module,
                        'action'      => $action,
                        'is_active'   => true,
                    ]
                );
            }
        }
    }
}
