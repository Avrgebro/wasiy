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
        ->assertJsonPath('active_account', null)
        ->assertJsonPath('resident_memberships', [])
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('accounts.0.id', $account->id)
        ->assertJsonCount(1, 'assigned_locations')
        ->assertJsonPath('assigned_locations.0.id', $location->id)
        ->assertJsonPath('assigned_locations.0.role', LocationRole::LocationManager->value)
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
        ->assertJsonCount(1, 'accounts')
        ->assertJsonPath('accounts.0.id', $account->id)
        ->assertJsonPath('roles.account.0.role', AccountRole::AccountAdmin->value)
        ->assertJsonCount(0, 'roles.location')
        ->assertJsonCount(0, 'assigned_locations');
});

test('it deduplicates accounts when a user has account and location roles in the same account', function () {
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
        ->assertJsonCount(1, 'roles.account')
        ->assertJsonCount(1, 'roles.location')
        ->assertJsonCount(1, 'assigned_locations');
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
        ->assertJsonCount(0, 'roles.account')
        ->assertJsonCount(0, 'roles.location')
        ->assertJsonCount(0, 'assigned_locations');
});
