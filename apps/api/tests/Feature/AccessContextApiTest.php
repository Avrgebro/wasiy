<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guests cannot manage access context', function () {
    $this->postJson('/api/context/account')->assertUnauthorized();
    $this->postJson('/api/context/location')->assertUnauthorized();
    $this->deleteJson('/api/context')->assertUnauthorized();
});

test('users can select an accessible account and receive refreshed access context', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($user)
        ->postJson('/api/context/account', [
            'account_id' => $account->id,
        ])
        ->assertOk()
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonPath('active_location.id', $location->id)
        ->assertJsonCount(1, 'accessible_locations');
});

test('users cannot select an inaccessible account', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/context/account', [
            'account_id' => $account->id,
        ])
        ->assertForbidden();
});

test('account context validates malformed account ids', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/context/account', [
            'account_id' => 'not-a-ulid',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('account_id');
});

test('selecting an account clears the previous active location and auto selects a single accessible location', function () {
    $user = User::factory()->create();
    $firstAccount = Account::factory()->create();
    $secondAccount = Account::factory()->create();
    $firstLocation = Location::factory()->for($firstAccount)->create();
    $secondLocation = Location::factory()->for($secondAccount)->create();

    LocationUserRole::query()->create([
        'account_id' => $firstAccount->id,
        'location_id' => $firstLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $secondAccount->id,
        'location_id' => $secondLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($user)
        ->withSession([
            'wasiy.active_account_id' => $firstAccount->id,
            'wasiy.active_location_id' => $firstLocation->id,
        ])
        ->postJson('/api/context/account', [
            'account_id' => $secondAccount->id,
        ])
        ->assertOk()
        ->assertJsonPath('active_account.id', $secondAccount->id)
        ->assertJsonPath('active_location.id', $secondLocation->id);
});

test('selecting a location requires an active account', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($user)
        ->postJson('/api/context/location', [
            'location_id' => $location->id,
        ])
        ->assertStatus(409);
});

test('users can select an accessible location inside the active account', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $firstLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $secondLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($user)
        ->withSession(['wasiy.active_account_id' => $account->id])
        ->postJson('/api/context/location', [
            'location_id' => $secondLocation->id,
        ])
        ->assertOk()
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonPath('active_location.id', $secondLocation->id)
        ->assertJsonCount(2, 'accessible_locations');
});

test('location selection rejects locations outside the active account as invalid input', function () {
    $user = User::factory()->create();
    $activeAccount = Account::factory()->create();
    $otherAccount = Account::factory()->create();
    $activeLocation = Location::factory()->for($activeAccount)->create();
    $otherLocation = Location::factory()->for($otherAccount)->create();

    LocationUserRole::query()->create([
        'account_id' => $activeAccount->id,
        'location_id' => $activeLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $otherAccount->id,
        'location_id' => $otherLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($user)
        ->withSession(['wasiy.active_account_id' => $activeAccount->id])
        ->postJson('/api/context/location', [
            'location_id' => $otherLocation->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_id');
});

test('location selection rejects inaccessible locations inside the active account', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $accessibleLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($user)
        ->withSession(['wasiy.active_account_id' => $account->id])
        ->postJson('/api/context/location', [
            'location_id' => $inaccessibleLocation->id,
        ])
        ->assertForbidden();
});

test('account admins can select any active location inside their active account', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $user->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $this->actingAs($user)
        ->withSession(['wasiy.active_account_id' => $account->id])
        ->postJson('/api/context/location', [
            'location_id' => $location->id,
        ])
        ->assertOk()
        ->assertJsonPath('active_location.id', $location->id)
        ->assertJsonPath('accessible_locations.0.access_source', 'account_role');
});

test('clearing context clears active account and location for multi account users', function () {
    $user = User::factory()->create();
    $firstAccount = Account::factory()->create();
    $secondAccount = Account::factory()->create();
    $firstLocation = Location::factory()->for($firstAccount)->create();
    $secondLocation = Location::factory()->for($secondAccount)->create();

    LocationUserRole::query()->create([
        'account_id' => $firstAccount->id,
        'location_id' => $firstLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $secondAccount->id,
        'location_id' => $secondLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($user)
        ->withSession([
            'wasiy.active_account_id' => $firstAccount->id,
            'wasiy.active_location_id' => $firstLocation->id,
        ])
        ->deleteJson('/api/context')
        ->assertOk()
        ->assertJsonPath('active_account', null)
        ->assertJsonPath('active_location', null)
        ->assertJsonCount(0, 'accessible_locations');
});
