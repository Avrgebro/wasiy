<?php

use App\Http\Controllers\Api\AccessContextController;
use App\Http\Controllers\Api\AccountStaffController;
use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PortalResidentController;
use App\Http\Controllers\Api\RegistryExportController;
use App\Http\Controllers\Api\ResidentController;
use App\Http\Controllers\Api\ResidentInvitationController;
use App\Http\Controllers\Api\StaffInvitationController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UnitMembershipController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::get('/resident-invitations/{token}', [ResidentInvitationController::class, 'show']);
Route::post('/resident-invitations/{token}/claim', [ResidentInvitationController::class, 'claim']);

Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    Route::get('/me', MeController::class);
    Route::post('/context/account', [AccessContextController::class, 'selectAccount']);
    Route::post('/context/location', [AccessContextController::class, 'selectLocation']);
    Route::delete('/context', [AccessContextController::class, 'clear']);
    Route::get('/accounts/{account}/staff', [AccountStaffController::class, 'index'])
        ->can('manageStaff', 'account');
    Route::post('/accounts/{account}/staff/invitations', [StaffInvitationController::class, 'store'])
        ->can('manageStaff', 'account');
    Route::patch('/accounts/{account}/staff/{user}/roles', [AccountStaffController::class, 'updateRoles'])
        ->can('manageStaff', 'account');
    Route::patch('/accounts/{account}/staff/{user}/locations', [AccountStaffController::class, 'updateLocations'])
        ->can('manageStaff', 'account');
    Route::get('/locations/{location}/dashboard', LocationDashboardController::class)
        ->can('view', 'location');
    Route::get('/locations/{location}/units', [UnitController::class, 'index']);
    Route::post('/locations/{location}/units', [UnitController::class, 'store']);
    Route::get('/locations/{location}/vehicles', [VehicleController::class, 'index']);
    Route::post('/locations/{location}/vehicles', [VehicleController::class, 'store']);
    Route::get('/units/{unit}', [UnitController::class, 'show']);
    Route::patch('/units/{unit}', [UnitController::class, 'update']);
    Route::delete('/units/{unit}', [UnitController::class, 'destroy']);
    Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show']);
    Route::patch('/vehicles/{vehicle}', [VehicleController::class, 'update']);
    Route::delete('/vehicles/{vehicle}', [VehicleController::class, 'destroy']);
    Route::get('/accounts/{account}/residents', [ResidentController::class, 'index']);
    Route::post('/accounts/{account}/residents', [ResidentController::class, 'store']);
    Route::get('/residents/{resident}', [ResidentController::class, 'show']);
    Route::patch('/residents/{resident}', [ResidentController::class, 'update']);
    Route::delete('/residents/{resident}', [ResidentController::class, 'destroy']);
    Route::post('/residents/{resident}/invitations', [ResidentInvitationController::class, 'store']);
    Route::post('/residents/{resident}/memberships', [UnitMembershipController::class, 'store']);
    Route::patch('/unit-memberships/{membership}', [UnitMembershipController::class, 'update']);
    Route::delete('/unit-memberships/{membership}', [UnitMembershipController::class, 'destroy']);
    Route::patch('/portal/resident/phone', [PortalResidentController::class, 'updatePhone']);
    Route::get('/portal/vehicles', [VehicleController::class, 'portalIndex']);
    Route::post('/portal/vehicles', [VehicleController::class, 'portalStore']);
    Route::patch('/portal/vehicles/{vehicle}', [VehicleController::class, 'portalUpdate']);
    Route::delete('/portal/vehicles/{vehicle}', [VehicleController::class, 'portalDestroy']);
    Route::get('/exports', [RegistryExportController::class, 'index']);
    Route::post('/exports', [RegistryExportController::class, 'store']);
    Route::get('/exports/{export}', [RegistryExportController::class, 'show']);
    Route::get('/exports/{export}/download', [RegistryExportController::class, 'download']);
});
