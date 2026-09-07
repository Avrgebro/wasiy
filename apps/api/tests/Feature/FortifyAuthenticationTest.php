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

test('remember me issues the long-lived remember cookie only when requested', function () {
    User::factory()->create([
        'email' => 'manager@wasiy.test',
        'password' => 'password',
    ]);

    $remembered = $this->postJson('/login', [
        'email' => 'manager@wasiy.test',
        'password' => 'password',
        'remember' => true,
    ])->assertOk();

    $cookie = collect($remembered->headers->getCookies())->first(fn ($c) => str_starts_with($c->getName(), 'remember_web_'));
    expect($cookie)->not->toBeNull()
        ->and($cookie->getExpiresTime())->toBeGreaterThan(now()->addYear()->getTimestamp());

    $this->postJson('/logout')->assertNoContent();

    $plain = $this->postJson('/login', [
        'email' => 'manager@wasiy.test',
        'password' => 'password',
        'remember' => false,
    ])->assertOk();

    expect(collect($plain->headers->getCookies())->first(fn ($c) => str_starts_with($c->getName(), 'remember_web_')))->toBeNull();
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

test('invalid json login credentials return validation errors', function () {
    User::factory()->create([
        'email' => 'manager@wasiy.test',
        'password' => 'password',
    ]);

    $response = $this->postJson('/login', [
        'email' => 'manager@wasiy.test',
        'password' => 'wrong-password',
    ]);

    expect($response->status())->toBe(422)
        ->and($response->json('message'))->toBe(trans('auth.failed'))
        ->and($response->json('errors.email.0'))->toBe(trans('auth.failed'));
});

test('deactivated users cannot log in', function () {
    $user = User::factory()->create([
        'email' => 'manager@wasiy.test',
        'password' => 'password',
    ]);

    $user->deactivate();

    $response = $this->postJson('/login', [
        'email' => 'manager@wasiy.test',
        'password' => 'password',
    ]);

    expect($response->status())->toBe(422)
        ->and($response->json('message'))->toBe(trans('auth.failed'));
});
