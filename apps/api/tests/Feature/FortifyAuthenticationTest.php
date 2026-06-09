<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a seeded location manager can log in and access the authenticated api context', function () {
    $this->seed();

    $this->postJson('/login', [
        'email' => 'manager@wasiy.test',
        'password' => 'password',
    ])->assertOk();

    $this->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('user.email', 'manager@wasiy.test');
});

test('invalid login credentials are rejected', function () {
    User::factory()->create([
        'email' => 'manager@wasiy.test',
        'password' => 'password',
    ]);

    $this->from('/login')
        ->post('/login', [
            'email' => 'manager@wasiy.test',
            'password' => 'wrong-password',
        ])
        ->assertRedirect('/login');
});
