<?php

use App\Http\Controllers\Api\AccessContextController;
use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\MeController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth:sanctum', EnsureUserIsActive::class])->group(function () {
    Route::get('/me', MeController::class);
    Route::post('/context/account', [AccessContextController::class, 'selectAccount']);
    Route::post('/context/location', [AccessContextController::class, 'selectLocation']);
    Route::delete('/context', [AccessContextController::class, 'clear']);
    Route::get('/locations/{location}/dashboard', LocationDashboardController::class)
        ->can('view', 'location');
});
