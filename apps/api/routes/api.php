<?php

use App\Http\Controllers\Api\LocationDashboardController;
use App\Http\Controllers\Api\MeController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    Route::get('/me', MeController::class);
    Route::get('/locations/{location}/dashboard', LocationDashboardController::class)
        ->can('view', 'location');
});
