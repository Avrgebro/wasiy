<?php

use App\Http\Controllers\Api\AccessContextController;
use App\Http\Controllers\Api\AccountStaffController;
use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\StaffInvitationController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth:sanctum', EnsureUserIsActive::class])->group(function () {
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
});
