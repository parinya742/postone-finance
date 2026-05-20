<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LineGroupExtractedFileController;
use App\Http\Controllers\Api\LineGroupFileController;
use App\Http\Controllers\Api\ThaipostImportController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PostoneAccountTypeController;
use App\Http\Controllers\Api\PostoneSessionController;
use App\Http\Controllers\Api\PostoneShipmentController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ShipmentAcceptanceController;
use App\Http\Controllers\Api\LineSoController;
use App\Http\Controllers\Api\SoHeadController;
use App\Http\Controllers\Api\SpecialPostalZoneController;
use App\Http\Controllers\Api\ThailandPostAcceptanceController;
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

    // === LINE Group Files ===
    Route::middleware('permission:line-files.view')->group(function () {
        Route::get('/line-files', [LineGroupFileController::class, 'index']);
        Route::get('/line-extracted', [LineGroupExtractedFileController::class, 'index']);
    });
    Route::middleware('permission:line-files.create')->post('/line-files/import', [ThaipostImportController::class, 'store']);

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
        Route::get('/iscode/line-so', [LineSoController::class, 'index']);
        Route::get('/iscode/line-so/export', [LineSoController::class, 'export']);
    });

    // === Master Data — Special Postal Zones ===
    Route::middleware('permission:special-zones.view')->group(function () {
        Route::get('/special-postal-zones', [SpecialPostalZoneController::class, 'index']);
    });
    Route::middleware('permission:special-zones.create')->post('/special-postal-zones', [SpecialPostalZoneController::class, 'store']);
    Route::middleware('permission:special-zones.edit')->put('/special-postal-zones/{id}', [SpecialPostalZoneController::class, 'update']);
    Route::middleware('permission:special-zones.delete')->delete('/special-postal-zones/{id}', [SpecialPostalZoneController::class, 'destroy']);
});