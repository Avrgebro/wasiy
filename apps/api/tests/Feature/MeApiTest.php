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

test('guests cannot view their access context', function () {
    $this->getJson('/api/me')->assertUnauthorized();
});

test('deactivated authenticated users cannot view their access context', function () {
    $user = User::factory()->create();
    $user->deactivate();

    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertForbidden();
});

test('it returns the authenticated user location scoped access context', function () {
    $this->seed();

    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();

    $this->actingAs($manager)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('user.email', 'manager@wasiy.test')
        ->assertJsonPath('user.name', 'Mariana Rojas')
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonPath('active_location.id', $location->id)
        ->assertJsonPath('resident_memberships', [])
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('accounts.0.id', $account->id)
        ->assertJsonCount(1, 'accessible_locations')
        ->assertJsonPath('accessible_locations.0.id', $location->id)
        ->assertJsonPath('accessible_locations.0.roles.0', LocationRole::LocationManager->value)
        ->assertJsonPath('accessible_locations.0.access_source', 'location_role')
        ->assertJsonCount(0, 'roles.account')
        ->assertJsonCount(1, 'roles.location')
        ->assertJsonPath('roles.location.0.role', LocationRole::LocationManager->value);
});

test('it includes account access from account scoped roles', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $user->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonPath('active_location', null)
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('accounts.0.id', $account->id)
        ->assertJsonPath('roles.account.0.role', AccountRole::AccountAdmin->value)
        ->assertJsonCount(0, 'roles.location')
        ->assertJsonCount(0, 'accessible_locations');
});

test('it gives account admins implicit access to active account locations', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $user->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonCount(1, 'roles.account')
        ->assertJsonCount(1, 'roles.location')
        ->assertJsonCount(1, 'accessible_locations')
        ->assertJsonPath('accessible_locations.0.id', $location->id)
        ->assertJsonPath('accessible_locations.0.roles.0', AccountRole::AccountAdmin->value)
        ->assertJsonPath('accessible_locations.0.roles.1', LocationRole::LocationManager->value)
        ->assertJsonPath('accessible_locations.0.access_source', 'both');
});

test('it excludes deleted role assignments from the access context', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();

    $accountRole = AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $user->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $locationRole = LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $accountRole->delete();
    $locationRole->delete();

    $this->actingAs($user)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonCount(0, 'accounts')
        ->assertJsonPath('active_account', null)
        ->assertJsonPath('active_location', null)
        ->assertJsonCount(0, 'roles.account')
        ->assertJsonCount(0, 'roles.location')
        ->assertJsonCount(0, 'accessible_locations');
});

test('users with multiple accounts must select an active account before account scoped context is returned', function () {
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
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonCount(2, 'accounts')
        ->assertJsonPath('active_account', null)
        ->assertJsonPath('active_location', null)
        ->assertJsonCount(0, 'roles.account')
        ->assertJsonCount(0, 'roles.location')
        ->assertJsonCount(0, 'accessible_locations');
});

test('active account scopes roles and accessible locations', function () {
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
        ->withSession(['wasiy.active_account_id' => $secondAccount->id])
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonCount(2, 'accounts')
        ->assertJsonPath('active_account.id', $secondAccount->id)
        ->assertJsonPath('active_location.id', $secondLocation->id)
        ->assertJsonCount(0, 'roles.account')
        ->assertJsonCount(1, 'roles.location')
        ->assertJsonPath('roles.location.0.account_id', $secondAccount->id)
        ->assertJsonPath('roles.location.0.role', LocationRole::FrontDesk->value)
        ->assertJsonCount(1, 'accessible_locations')
        ->assertJsonPath('accessible_locations.0.id', $secondLocation->id);
});

test('stale active account context is cleared before normal selection rules are applied', function () {
    $user = User::factory()->create();
    $staleAccount = Account::factory()->create();
    $activeAccount = Account::factory()->create();
    $location = Location::factory()->for($activeAccount)->create();

    LocationUserRole::query()->create([
        'account_id' => $activeAccount->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($user)
        ->withSession(['wasiy.active_account_id' => $staleAccount->id])
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('active_account.id', $activeAccount->id)
        ->assertJsonPath('active_location.id', $location->id);
});

test('stale active location context is cleared and a single accessible location is auto selected', function () {
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $staleLocation = Location::factory()->for($account)->create();
    $location = Location::factory()->for($account)->create();

    $staleLocation->delete();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($user)
        ->withSession([
            'wasiy.active_account_id' => $account->id,
            'wasiy.active_location_id' => $staleLocation->id,
        ])
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $account->id)
        ->assertJsonPath('active_location.id', $location->id);
});
