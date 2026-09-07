<?php

use App\Http\Controllers\LoginCodeController;
use App\Http\Controllers\RegistrationController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('registration')->controller(RegistrationController::class)->group(function () {
    Route::get('/', 'show')->middleware('throttle:30,1');
    Route::post('/', 'store')->middleware('throttle:5,1')->block();
    Route::post('/resend', 'resend')->middleware('throttle:5,1')->block();
    Route::post('/verify', 'verify')->middleware('throttle:10,1')->block();
    Route::post('/complete', 'complete')->middleware('throttle:5,1')->block();
});

// Passwordless login. Fortify owns POST /login; these sit beside it.
Route::prefix('login/code')->controller(LoginCodeController::class)->group(function () {
    Route::get('/', 'show')->middleware('throttle:30,1');
    Route::post('/request', [LoginCodeController::class, 'request'])->middleware('throttle:login-code-request')->block();
    Route::post('/verify', 'verify')->middleware('throttle:login-code-verify')->block();
});
