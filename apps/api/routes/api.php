<?php

use App\Http\Controllers\Api\AccessContextController;
use App\Http\Controllers\Api\AccountStaffController;
use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PortalResidentController;
use App\Http\Controllers\Api\PortalVehicleController;
use App\Http\Controllers\Api\RegistryExportController;
use App\Http\Controllers\Api\RegistryImportController;
use App\Http\Controllers\Api\ResidentController;
use App\Http\Controllers\Api\ResidentInvitationController;
use App\Http\Controllers\Api\StaffInvitationController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UnitMembershipController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

// Guest invitation flows: the emailed token is the credential.
Route::get('/resident-invitations/{token}', [ResidentInvitationController::class, 'show']);
Route::post('/resident-invitations/{token}/claim', [ResidentInvitationController::class, 'claim']);
Route::get('/staff-invitations/{token}', [StaffInvitationController::class, 'show']);
Route::post('/staff-invitations/{token}/accept', [StaffInvitationController::class, 'accept']);

Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    // Session and access context.
    Route::get('/me', MeController::class);
    Route::post('/context/account', [AccessContextController::class, 'selectAccount']);
    Route::post('/context/location', [AccessContextController::class, 'selectLocation']);
    Route::delete('/context', [AccessContextController::class, 'clear']);

    // Staff management: Account Admins only, enforced once on the group.
    Route::middleware('can:manageStaff,account')->group(function () {
        Route::get('/accounts/{account}/staff', [AccountStaffController::class, 'index']);
        Route::post('/accounts/{account}/staff/invitations', [StaffInvitationController::class, 'store']);
        Route::delete('/accounts/{account}/staff/invitations/{invitation}', [StaffInvitationController::class, 'destroy']);
        Route::post('/accounts/{account}/staff/invitations/{invitation}/resend', [StaffInvitationController::class, 'resend']);
        Route::patch('/accounts/{account}/staff/{user}/roles', [AccountStaffController::class, 'updateRoles']);
        Route::patch('/accounts/{account}/staff/{user}/locations', [AccountStaffController::class, 'updateLocations']);
    });

    // Staff registry surface: fine-grained authorization lives in the
    // controllers' gates and FormRequests.
    Route::get('/locations/{location}/dashboard', LocationDashboardController::class)
        ->can('view', 'location');
    Route::get('/locations/{location}/units', [UnitController::class, 'index']);
    Route::post('/locations/{location}/units', [UnitController::class, 'store']);
    Route::get('/locations/{location}/vehicles', [VehicleController::class, 'index']);
    Route::post('/locations/{location}/vehicles', [VehicleController::class, 'store']);
    Route::post('/locations/{location}/registry-imports', [RegistryImportController::class, 'store']);
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
    Route::delete('/residents/{resident}/invitations/{invitation}', [ResidentInvitationController::class, 'destroy']);
    Route::post('/residents/{resident}/invitations/{invitation}/resend', [ResidentInvitationController::class, 'resend']);
    Route::post('/residents/{resident}/memberships', [UnitMembershipController::class, 'store']);
    Route::patch('/unit-memberships/{membership}', [UnitMembershipController::class, 'update']);
    Route::delete('/unit-memberships/{membership}', [UnitMembershipController::class, 'destroy']);
    Route::get('/exports', [RegistryExportController::class, 'index']);
    Route::post('/exports', [RegistryExportController::class, 'store']);
    Route::get('/exports/{export}', [RegistryExportController::class, 'show']);
    Route::get('/exports/{export}/download', [RegistryExportController::class, 'download']);
    Route::get('/registry-imports', [RegistryImportController::class, 'index']);
    Route::get('/registry-imports/{import}', [RegistryImportController::class, 'show']);
    Route::get('/registry-imports/{import}/rows', [RegistryImportController::class, 'rows']);
    Route::post('/registry-imports/{import}/confirm', [RegistryImportController::class, 'confirm']);
    Route::post('/registry-imports/{import}/retry', [RegistryImportController::class, 'retry']);

    // Resident portal: gated by resident-membership policies, never staff
    // roles.
    Route::prefix('portal')->group(function () {
        Route::patch('/resident/phone', [PortalResidentController::class, 'updatePhone']);
        Route::get('/vehicles', [PortalVehicleController::class, 'index']);
        Route::post('/vehicles', [PortalVehicleController::class, 'store']);
        Route::patch('/vehicles/{vehicle}', [PortalVehicleController::class, 'update']);
        Route::delete('/vehicles/{vehicle}', [PortalVehicleController::class, 'destroy']);
    });
});
