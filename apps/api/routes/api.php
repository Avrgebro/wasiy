<?php

use App\Http\Controllers\Api\AccessContextController;
use App\Http\Controllers\Api\AccountSettingsController;
use App\Http\Controllers\Api\AccountStaffController;
use App\Http\Controllers\Api\AmenityController;
use App\Http\Controllers\Api\AmenityPhotoController;
use App\Http\Controllers\Api\FinancialMovementController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\LocationPhotoController;
use App\Http\Controllers\Api\LocationSettingsController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\PortalResidentController;
use App\Http\Controllers\Api\PortalVehicleController;
use App\Http\Controllers\Api\RegistryExportController;
use App\Http\Controllers\Api\RegistryImportController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\ResidentController;
use App\Http\Controllers\Api\ResidentInvitationController;
use App\Http\Controllers\Api\StaffInvitationController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\UnitMembershipController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\VisitController;
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
        Route::get('/accounts/{account}/staff/invitations', [StaffInvitationController::class, 'index']);
        Route::post('/accounts/{account}/staff/invitations', [StaffInvitationController::class, 'store']);
        Route::delete('/accounts/{account}/staff/invitations/{invitation}', [StaffInvitationController::class, 'destroy']);
        Route::post('/accounts/{account}/staff/invitations/{invitation}/resend', [StaffInvitationController::class, 'resend']);
        Route::patch('/accounts/{account}/staff/{user}/access', [AccountStaffController::class, 'updateAccess']);
        Route::post('/accounts/{account}/staff/{user}/deactivate', [AccountStaffController::class, 'deactivate']);
        Route::post('/accounts/{account}/staff/{user}/reactivate', [AccountStaffController::class, 'reactivate']);
    });

    // Location management: cross-account probes 404 in the controllers,
    // role-level rules live in LocationPolicy / AccountPolicy. Scoped
    // bindings resolve {location} inside {account}, so a Location reached
    // through the wrong Account 404s before any policy runs.
    Route::scopeBindings()->group(function () {
        Route::get('/accounts/{account}/locations', [LocationController::class, 'index']);
        Route::post('/accounts/{account}/locations', [LocationController::class, 'store']);
        Route::get('/accounts/{account}/locations/{location}', [LocationController::class, 'show']);
        Route::patch('/accounts/{account}/locations/{location}', [LocationController::class, 'update']);
        Route::post('/accounts/{account}/locations/{location}/deactivate', [LocationController::class, 'deactivate']);
        Route::post('/accounts/{account}/locations/{location}/reactivate', [LocationController::class, 'reactivate']);
        Route::post('/accounts/{account}/locations/{location}/photos', [LocationPhotoController::class, 'store']);
        Route::put('/accounts/{account}/locations/{location}/photos/order', [LocationPhotoController::class, 'reorder']);
        Route::delete('/accounts/{account}/locations/{location}/photos/{photo}', [LocationPhotoController::class, 'destroy']);
        Route::post('/accounts/{account}/locations/{location}/photos/{photo}/cover', [LocationPhotoController::class, 'cover']);
        Route::get('/accounts/{account}/locations/{location}/amenities', [AmenityController::class, 'index']);
        Route::post('/accounts/{account}/locations/{location}/amenities', [AmenityController::class, 'store']);
        Route::get('/accounts/{account}/locations/{location}/amenities/{amenity}', [AmenityController::class, 'show']);
        Route::patch('/accounts/{account}/locations/{location}/amenities/{amenity}', [AmenityController::class, 'update']);
        Route::post('/accounts/{account}/locations/{location}/amenities/{amenity}/deactivate', [AmenityController::class, 'deactivate']);
        Route::post('/accounts/{account}/locations/{location}/amenities/{amenity}/reactivate', [AmenityController::class, 'reactivate']);
        Route::post('/accounts/{account}/locations/{location}/amenities/{amenity}/photos', [AmenityPhotoController::class, 'store']);
        Route::put('/accounts/{account}/locations/{location}/amenities/{amenity}/photos/order', [AmenityPhotoController::class, 'reorder']);
        Route::delete('/accounts/{account}/locations/{location}/amenities/{amenity}/photos/{photo}', [AmenityPhotoController::class, 'destroy']);
        Route::post('/accounts/{account}/locations/{location}/amenities/{amenity}/photos/{photo}/cover', [AmenityPhotoController::class, 'cover']);
        Route::get('/accounts/{account}/locations/{location}/reservations', [ReservationController::class, 'index']);
        Route::post('/accounts/{account}/locations/{location}/reservations', [ReservationController::class, 'store']);
        Route::get('/accounts/{account}/reservations/{reservation}', [ReservationController::class, 'show']);
        Route::post('/accounts/{account}/reservations/{reservation}/approve', [ReservationController::class, 'approve']);
        Route::post('/accounts/{account}/reservations/{reservation}/reject', [ReservationController::class, 'reject']);
        Route::post('/accounts/{account}/reservations/{reservation}/observe', [ReservationController::class, 'observe']);
        Route::post('/accounts/{account}/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
        Route::get('/accounts/{account}/locations/{location}/finances/movements', [FinancialMovementController::class, 'index']);
        Route::get('/accounts/{account}/locations/{location}/finances/summary', [FinancialMovementController::class, 'summary']);
        Route::post('/accounts/{account}/locations/{location}/finances/movements', [FinancialMovementController::class, 'store']);
        Route::post('/accounts/{account}/locations/{location}/finances/dues', [FinancialMovementController::class, 'generateDues']);
        Route::get('/accounts/{account}/finances/movements/{financialMovement}', [FinancialMovementController::class, 'show']);
        Route::post('/accounts/{account}/finances/movements/{financialMovement}/status', [FinancialMovementController::class, 'transition']);
        Route::get('/accounts/{account}/locations/{location}/settings', [LocationSettingsController::class, 'show']);
        Route::put('/accounts/{account}/locations/{location}/settings', [LocationSettingsController::class, 'update']);
    });
    // Photo bytes: authorization delegates to the owner's view policy.
    Route::get('/photos/{photo}', [PhotoController::class, 'show']);
    Route::get('/accounts/{account}/settings', [AccountSettingsController::class, 'show']);
    Route::put('/accounts/{account}/settings', [AccountSettingsController::class, 'update']);

    // Staff registry surface: fine-grained authorization lives in the
    // controllers' gates and FormRequests.
    Route::get('/locations/{location}/dashboard', LocationDashboardController::class)
        ->can('view', 'location');
    Route::get('/locations/{location}/units', [UnitController::class, 'index']);
    Route::post('/locations/{location}/units', [UnitController::class, 'store']);
    Route::get('/locations/{location}/vehicles', [VehicleController::class, 'index']);
    Route::post('/locations/{location}/vehicles', [VehicleController::class, 'store']);
    Route::post('/locations/{location}/registry-imports', [RegistryImportController::class, 'store']);
    Route::get('/locations/{location}/packages', [PackageController::class, 'index']);
    Route::post('/locations/{location}/packages', [PackageController::class, 'store']);
    Route::post('/packages/{package}/deliver', [PackageController::class, 'deliver']);
    Route::get('/locations/{location}/visits', [VisitController::class, 'index']);
    Route::post('/locations/{location}/visits', [VisitController::class, 'store']);
    Route::post('/visits/{visit}/check-out', [VisitController::class, 'checkOut']);
    Route::get('/units/{unit}', [UnitController::class, 'show']);
    Route::post('/units/{unit}/notes', [UnitController::class, 'storeNote']);
    Route::post('/units/{unit}/deactivate', [UnitController::class, 'deactivate']);
    Route::post('/units/{unit}/reactivate', [UnitController::class, 'reactivate']);
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
    Route::post('/residents/{resident}/deactivate', [ResidentController::class, 'deactivate']);
    Route::post('/residents/{resident}/reactivate', [ResidentController::class, 'reactivate']);
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
