<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DomesticLetterRateController;
use App\Http\Controllers\Api\EmsRateController;
use App\Http\Controllers\Api\LazadaInvoiceController;
use App\Http\Controllers\Api\LazadaSessionController;
use App\Http\Controllers\Api\LazadaSessionLogController;
use App\Http\Controllers\Api\LazadaShopController;
use App\Http\Controllers\Api\LazadaTransactionController;
use App\Http\Controllers\Api\LazadaTransactionFileController;
use App\Http\Controllers\Api\LazadaTransactionWorkController;
use App\Http\Controllers\Api\MasterBankController;
use App\Http\Controllers\Api\LineGroupExtractedFileController;
use App\Http\Controllers\Api\LineGroupFileController;
use App\Http\Controllers\Api\LineGroupMediaController;
use App\Http\Controllers\Api\LineSoController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PostoneAccountTypeController;
use App\Http\Controllers\Api\PostoneExportFileController;
use App\Http\Controllers\Api\PostoneSessionController;
use App\Http\Controllers\Api\PostoneShipmentController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ShipmentAcceptanceController;
use App\Http\Controllers\Api\ShopeeIncomeSyncLogController;
use App\Http\Controllers\Api\ShopeeOrderFileController;
use App\Http\Controllers\Api\ShopeeOrderItemController;
use App\Http\Controllers\Api\ShopeeOrderSyncLogController;
use App\Http\Controllers\Api\ShopeeSessionController;
use App\Http\Controllers\Api\ShopeeSessionLogController;
use App\Http\Controllers\Api\ShopeeShopController;
use App\Http\Controllers\Api\ShopeeTransactionController;
use App\Http\Controllers\Api\ShopeeTransactionFileController;
use App\Http\Controllers\Api\ShopeeWalletFileController;
use App\Http\Controllers\Api\ShopeeWalletSyncLogController;
use App\Http\Controllers\Api\ShopeeWalletTransactionController;
use App\Http\Controllers\Api\SoHeadController;
use App\Http\Controllers\Api\SpecialPostalZoneController;
use App\Http\Controllers\Api\ThailandPostAcceptanceController;
use App\Http\Controllers\Api\ThaipostImportController;
use App\Http\Controllers\Api\TikTokShopController;
use App\Http\Controllers\Api\TikTokTransactionController;
use App\Http\Controllers\Api\TikTokTransactionFileController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});

// Protected
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    });

    // Roles — requires roles.view or higher
    Route::middleware('permission:roles.view')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/roles/{role}', [RoleController::class, 'show']);
    });
    Route::middleware('permission:roles.create')->post('/roles', [RoleController::class, 'store']);
    Route::middleware('permission:roles.edit')->group(function () {
        Route::put('/roles/{role}', [RoleController::class, 'update']);
        Route::post('/roles/{role}/permissions', [RoleController::class, 'syncPermissions']);
    });
    Route::middleware('permission:roles.delete')->delete('/roles/{role}', [RoleController::class, 'destroy']);

    // Permissions
    Route::middleware('permission:permissions.view')->group(function () {
        Route::get('/permissions', [PermissionController::class, 'index']);
        Route::get('/permissions/{permission}', [PermissionController::class, 'show']);
    });
    Route::middleware('permission:permissions.create')->post('/permissions', [PermissionController::class, 'store']);
    Route::middleware('permission:permissions.edit')->put('/permissions/{permission}', [PermissionController::class, 'update']);
    Route::middleware('permission:permissions.delete')->delete('/permissions/{permission}', [PermissionController::class, 'destroy']);

    // Users
    Route::middleware('permission:users.view')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/users/{user}', [UserController::class, 'show']);
    });
    Route::middleware('permission:users.create')->post('/users', [UserController::class, 'store']);
    Route::middleware('permission:users.edit')->group(function () {
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::post('/users/{user}/roles', [UserController::class, 'assignRoles']);
        Route::delete('/users/{user}/roles/{role}', [UserController::class, 'revokeRole']);
    });
    Route::middleware('permission:users.delete')->delete('/users/{user}', [UserController::class, 'destroy']);

    // === Postone Account Types (CRUD) ===
    Route::middleware('permission:account-types.view,shipments.view')->group(function () {
        Route::get('/account-types', [PostoneAccountTypeController::class, 'index']);
        Route::get('/account-types/{postoneAccountType}', [PostoneAccountTypeController::class, 'show']);
    });
    Route::middleware('permission:account-types.create')->post('/account-types', [PostoneAccountTypeController::class, 'store']);
    Route::middleware('permission:account-types.edit')->put('/account-types/{postoneAccountType}', [PostoneAccountTypeController::class, 'update']);
    Route::middleware('permission:account-types.delete')->delete('/account-types/{postoneAccountType}', [PostoneAccountTypeController::class, 'destroy']);

    // === Postone Sessions ===
    Route::middleware('permission:sessions.view')->get('/postone-sessions', [PostoneSessionController::class, 'index']);
    Route::middleware('permission:sessions.delete')->delete('/postone-sessions/{postoneSession}', [PostoneSessionController::class, 'destroy']);

    // === Postone Shipments ===
    Route::middleware('permission:shipments.view')->group(function () {
        Route::get('/shipments', [PostoneShipmentController::class, 'index']);
        Route::get('/shipments/{labelId}', [PostoneShipmentController::class, 'show']);
    });

    // === Postone Export Files ===
    Route::middleware('permission:shipments.view')->group(function () {
        Route::get('/export-files', [PostoneExportFileController::class, 'index']);
    });

    // === LINE Group Files ===
    Route::middleware('permission:line-files.view')->group(function () {
        Route::get('/line-files', [LineGroupFileController::class, 'index']);
        Route::get('/line-extracted', [LineGroupExtractedFileController::class, 'index']);
        Route::get('/line-files/{fileId}/notes', [\App\Http\Controllers\Api\LineGroupFileNoteController::class, 'index']);
    });
    Route::middleware('permission:line-files.create')->group(function () {
        Route::post('/line-files/import', [ThaipostImportController::class, 'store']);
        Route::post('/line-files/{fileId}/notes', [\App\Http\Controllers\Api\LineGroupFileNoteController::class, 'store']);
    });
    Route::middleware('permission:line-files.edit')->group(function () {
        Route::put('/line-files/notes/{id}', [\App\Http\Controllers\Api\LineGroupFileNoteController::class, 'update']);
        Route::patch('/line-files/{id}/toggle-active', [LineGroupFileController::class, 'toggleActive']);
    });
    Route::middleware('permission:line-files.delete')->group(function () {
        Route::delete('/line-files/notes/{id}', [\App\Http\Controllers\Api\LineGroupFileNoteController::class, 'destroy']);
    });

    // === LINE Group Media ===
    Route::middleware('permission:line-media.view')->group(function () {
        Route::get('/line-media', [LineGroupMediaController::class, 'index']);
        Route::get('/line-media/{id}', [LineGroupMediaController::class, 'show']);
    });
    Route::middleware('permission:line-media.import')->post('/line-media', [LineGroupMediaController::class, 'store']);
    Route::middleware('permission:line-media.delete')->group(function () {
        Route::delete('/line-media/{id}', [LineGroupMediaController::class, 'destroy']);
        Route::patch('/line-media/{id}/restore', [LineGroupMediaController::class, 'restore']);
    });

    // === Thailand Post Acceptance ===
    Route::middleware('permission:thaipost.view')->group(function () {
        Route::get('/thaipost', [ThailandPostAcceptanceController::class, 'index']);
        Route::get('/thaipost/{id}', [ThailandPostAcceptanceController::class, 'show']);
    });

    // === Shipment Acceptance Join (Shipments + Thailand Post) ===
    Route::middleware('permission:shipments.view')->group(function () {
        Route::get('/shipment-acceptance', [ShipmentAcceptanceController::class, 'index']);
        Route::get('/shipment-acceptance/export', [ShipmentAcceptanceController::class, 'export']);
    });

    // === ISCODE — SO Head ===
    Route::middleware('permission:iscode.view')->group(function () {
        Route::get('/iscode/so-head', [SoHeadController::class, 'index']);
    });

    // === ISCODE — Line SO Report ===
    Route::middleware('permission:line-so.view')->group(function () {
        Route::get('/iscode/line-so', [LineSoController::class, 'index']);
        Route::get('/iscode/line-so/summary', [LineSoController::class, 'summary']);
        Route::get('/iscode/line-so/export', [LineSoController::class, 'export']);
        Route::get('/iscode/line-so/field-sale-areas', [LineSoController::class, 'fieldSaleAreas']);
    });

    // === Master Data — Special Postal Zones ===
    Route::middleware('permission:special-zones.view')->group(function () {
        Route::get('/special-postal-zones', [SpecialPostalZoneController::class, 'index']);
    });
    Route::middleware('permission:special-zones.create')->post('/special-postal-zones', [SpecialPostalZoneController::class, 'store']);
    Route::middleware('permission:special-zones.edit')->put('/special-postal-zones/{id}', [SpecialPostalZoneController::class, 'update']);
    Route::middleware('permission:special-zones.delete')->delete('/special-postal-zones/{id}', [SpecialPostalZoneController::class, 'destroy']);

    // === Master Data — EMS Rates ===
    Route::middleware('permission:ems-rates.view')->group(function () {
        Route::get('/ems-rates', [EmsRateController::class, 'index']);
    });
    Route::middleware('permission:ems-rates.create')->post('/ems-rates', [EmsRateController::class, 'store']);
    Route::middleware('permission:ems-rates.edit')->group(function () {
        Route::put('/ems-rates/offset', [EmsRateController::class, 'updateOffset']);
        Route::put('/ems-rates/{id}', [EmsRateController::class, 'update']);
    });
    Route::middleware('permission:ems-rates.delete')->delete('/ems-rates/{id}', [EmsRateController::class, 'destroy']);

    // === Master Data (shared) ===
    Route::get('/master-banks', [MasterBankController::class, 'index']);

    // === Lazada ===
    Route::middleware('permission:lazada-shops.view')->group(function () {
        Route::get('/lazada/shops', [LazadaShopController::class, 'index']);
        Route::get('/lazada/auth-config', [LazadaShopController::class, 'authConfig']);
        Route::get('/lazada/shops/{id}/auth-url', [LazadaShopController::class, 'getAuthUrl']);
        Route::get('/lazada/transactions', [LazadaTransactionController::class, 'index']);
        Route::get('/lazada/transactions-work', [LazadaTransactionWorkController::class, 'index']);
        Route::get('/lazada/transactions-work/ids', [LazadaTransactionWorkController::class, 'ids']);
        Route::patch('/lazada/transactions-work/bulk-transfer', [LazadaTransactionWorkController::class, 'bulkTransfer']);
        Route::post('/lazada/transactions-work/smart-undo', [LazadaTransactionWorkController::class, 'smartUndo']);
        Route::get('/lazada/files', [LazadaTransactionFileController::class, 'index']);
    });
    Route::middleware('permission:lazada-shops.create')->post('/lazada/shops', [LazadaShopController::class, 'store']);
    Route::middleware('permission:lazada-shops.edit')->group(function () {
        Route::put('/lazada/shops/{id}', [LazadaShopController::class, 'update']);
        Route::post('/lazada/shops/{id}/exchange-token', [LazadaShopController::class, 'exchangeToken']);
        Route::post('/lazada/shops/{id}/refresh-token', [LazadaShopController::class, 'refreshToken']);
        Route::post('/lazada/shops/auto-refresh', [LazadaShopController::class, 'autoRefresh']);
    });
    Route::middleware('permission:lazada-shops.delete')->delete('/lazada/shops/{id}', [LazadaShopController::class, 'destroy']);
    // === Audit Logs ===
    Route::middleware('permission:audit_logs.view')->get('/audit-logs', [AuditLogController::class, 'index']);
    Route::post('/audit-logs', [AuditLogController::class, 'store']);

    // === Lazada Sessions (cookie-based) ===
    Route::middleware('permission:lazada-sessions.view')->group(function () {
        Route::get('/lazada/sessions', [LazadaSessionController::class, 'index']);
        Route::get('/lazada/sessions/shop-keys', [LazadaSessionController::class, 'shopKeys']);
        Route::get('/lazada/session-logs', [LazadaSessionLogController::class, 'index']);
    });
    Route::middleware('permission:lazada-sessions.create')->post('/lazada/sessions', [LazadaSessionController::class, 'store']);
    Route::middleware('permission:lazada-sessions.edit')->put('/lazada/sessions/{id}', [LazadaSessionController::class, 'update']);
    Route::middleware('permission:lazada-sessions.delete')->delete('/lazada/sessions/{id}', [LazadaSessionController::class, 'destroy']);

    Route::middleware('permission:lazada-invoices.view')->group(function () {
        Route::get('/lazada/invoices', [LazadaInvoiceController::class, 'index']);
    });

    // === TikTok ===
    Route::middleware('permission:tiktok-shops.view')->group(function () {
        Route::get('/tiktok/shops', [TikTokShopController::class, 'index']);
        Route::get('/tiktok/auth-config', [TikTokShopController::class, 'authConfig']);
        Route::get('/tiktok/shops/{id}/auth-url', [TikTokShopController::class, 'getAuthUrl']);
        Route::get('/tiktok/transactions', [TikTokTransactionController::class, 'index']);
        Route::get('/tiktok/files', [TikTokTransactionFileController::class, 'index']);
    });
    Route::middleware('permission:tiktok-shops.create')->post('/tiktok/shops', [TikTokShopController::class, 'store']);
    Route::middleware('permission:tiktok-shops.edit')->group(function () {
        Route::put('/tiktok/shops/{id}', [TikTokShopController::class, 'update']);
        Route::post('/tiktok/shops/{id}/exchange-token', [TikTokShopController::class, 'exchangeToken']);
        Route::post('/tiktok/shops/{id}/refresh-token', [TikTokShopController::class, 'refreshToken']);
        Route::post('/tiktok/shops/auto-refresh', [TikTokShopController::class, 'autoRefresh']);
    });
    Route::middleware('permission:tiktok-shops.delete')->delete('/tiktok/shops/{id}', [TikTokShopController::class, 'destroy']);

    // === Shopee ===
    Route::middleware('permission:shopee-shops.view')->group(function () {
        Route::get('/shopee/shops', [ShopeeShopController::class, 'index']);
        Route::get('/shopee/auth-config', [ShopeeShopController::class, 'authConfig']);
        Route::get('/shopee/shops/{shopId}/auth-url', [ShopeeShopController::class, 'getAuthUrl']);
        Route::get('/shopee/transactions', [ShopeeTransactionController::class, 'index']);
        Route::get('/shopee/files', [ShopeeTransactionFileController::class, 'index']);
        Route::get('/shopee/orders', [ShopeeOrderItemController::class, 'index']);
        Route::get('/shopee/order-files', [ShopeeOrderFileController::class, 'index']);
        Route::get('/shopee/wallet-transactions', [ShopeeWalletTransactionController::class, 'index']);
        Route::get('/shopee/wallet-files', [ShopeeWalletFileController::class, 'index']);
        Route::get('/shopee/wallet-sync-logs', [ShopeeWalletSyncLogController::class, 'index']);
        Route::get('/shopee/order-sync-logs', [ShopeeOrderSyncLogController::class, 'index']);
        Route::get('/shopee/income-sync-logs', [ShopeeIncomeSyncLogController::class, 'index']);
    });
    Route::middleware('permission:shopee-shops.create')->post('/shopee/shops', [ShopeeShopController::class, 'store']);
    Route::middleware('permission:shopee-shops.edit')->group(function () {
        Route::put('/shopee/shops/{shopId}', [ShopeeShopController::class, 'update']);
        Route::post('/shopee/shops/{shopId}/exchange-token', [ShopeeShopController::class, 'exchangeToken']);
        Route::post('/shopee/shops/{shopId}/refresh-token', [ShopeeShopController::class, 'refreshToken']);
    });
    Route::middleware('permission:shopee-shops.delete')->delete('/shopee/shops/{shopId}', [ShopeeShopController::class, 'destroy']);

    // === Shopee Sessions (cookie-based) ===
    Route::middleware('permission:shopee-sessions.view')->group(function () {
        Route::get('/shopee/sessions', [ShopeeSessionController::class, 'index']);
        Route::get('/shopee/sessions/shop-keys', [ShopeeSessionController::class, 'shopKeys']);
        Route::get('/shopee/session-logs', [ShopeeSessionLogController::class, 'index']);
    });
    Route::middleware('permission:shopee-sessions.create')->post('/shopee/sessions', [ShopeeSessionController::class, 'store']);
    Route::middleware('permission:shopee-sessions.edit')->group(function () {
        Route::put('/shopee/sessions/{id}', [ShopeeSessionController::class, 'update']);
        Route::post('/shopee/sessions/{id}/trigger-capture', [ShopeeSessionController::class, 'triggerCapture']);
    });
    Route::middleware('permission:shopee-sessions.delete')->delete('/shopee/sessions/{id}', [ShopeeSessionController::class, 'destroy']);

    // === Master Data — Domestic Letter Rates ===
    Route::middleware('permission:domestic-letter-rates.view')->group(function () {
        Route::get('/domestic-letter-rates', [DomesticLetterRateController::class, 'index']);
    });
    Route::middleware('permission:domestic-letter-rates.create')->post('/domestic-letter-rates', [DomesticLetterRateController::class, 'store']);
    Route::middleware('permission:domestic-letter-rates.edit')->group(function () {
        Route::put('/domestic-letter-rates/offset', [DomesticLetterRateController::class, 'updateOffset']);
        Route::put('/domestic-letter-rates/{id}', [DomesticLetterRateController::class, 'update']);
    });
    Route::middleware('permission:domestic-letter-rates.delete')->delete('/domestic-letter-rates/{id}', [DomesticLetterRateController::class, 'destroy']);
});
