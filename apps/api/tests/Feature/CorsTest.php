<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('spa origin can preflight sanctum csrf requests with credentials', function () {
    $this->withHeaders([
        'Origin' => 'http://localhost:5174',
        'Access-Control-Request-Method' => 'GET',
    ])
        ->options('/sanctum/csrf-cookie')
        ->assertNoContent()
        ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5174')
        ->assertHeader('Access-Control-Allow-Credentials', 'true');
});

test('spa origin receives cors headers on authenticated api responses', function () {
    $this->withHeaders([
        'Origin' => 'http://localhost:5174',
    ])
        ->getJson('/api/me')
        ->assertUnauthorized()
        ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5174')
        ->assertHeader('Access-Control-Allow-Credentials', 'true');
});
