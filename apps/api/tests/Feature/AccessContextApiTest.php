<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\Location;
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

    grantLocationRole($account, $location, $user, LocationRole::LocationManager);

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

    grantLocationRole($firstAccount, $firstLocation, $user, LocationRole::LocationManager);

    grantLocationRole($secondAccount, $secondLocation, $user, LocationRole::FrontDesk);

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

    grantLocationRole($account, $location, $user, LocationRole::LocationManager);

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

    grantLocationRole($account, $firstLocation, $user, LocationRole::LocationManager);

    grantLocationRole($account, $secondLocation, $user, LocationRole::FrontDesk);

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

    grantLocationRole($activeAccount, $activeLocation, $user, LocationRole::LocationManager);

    grantLocationRole($otherAccount, $otherLocation, $user, LocationRole::FrontDesk);

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

    grantLocationRole($account, $accessibleLocation, $user, LocationRole::LocationManager);

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

    createStaffMembership($account, $user, AccountRole::AccountAdmin);

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

    grantLocationRole($firstAccount, $firstLocation, $user, LocationRole::LocationManager);

    grantLocationRole($secondAccount, $secondLocation, $user, LocationRole::FrontDesk);

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

test('an account admin with several locations gets the first one selected', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();

    // Created out of alphabetical order so the assertion pins the ordering
    // rather than insertion order.
    Location::factory()->for($account)->create(['name' => 'Torre Norte']);
    $firstByName = Location::factory()->for($account)->create(['name' => 'Edificio Central']);

    createStaffMembership($account, $user, AccountRole::AccountAdmin);

    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_location.id', $firstByName->id)
        ->assertJsonCount(2, 'accessible_locations');
});

test('an account admin with no locations has no active location', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();

    createStaffMembership($account, $user, AccountRole::AccountAdmin);

    // A brand new Account has nothing to scope to yet. The null is what tells
    // the admin surface to offer location creation instead of a dashboard.
    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonPath('active_location', null)
        ->assertJsonCount(0, 'accessible_locations');
});
