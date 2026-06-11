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

test('guests cannot view a location dashboard', function () {
    $location = Location::factory()->create();

    $this->getJson("/api/locations/{$location->id}/dashboard")
        ->assertUnauthorized();
});

test('assigned location managers can view their location dashboard', function () {
    $this->seed();

    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();

    $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('location.id', $location->id)
        ->assertJsonPath('location.name', 'Edificio Central')
        ->assertJsonPath('metrics.assigned_staff_count', 2);
});

test('users without an assignment cannot view a location dashboard', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertForbidden();
});

test('users with deleted location assignments cannot view a location dashboard', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    $assignment = LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $assignment->delete();

    $this->actingAs($user)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertForbidden();
});

test('account admins can view dashboards for locations in their account', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $this->actingAs($admin)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('location.id', $location->id)
        ->assertJsonPath('metrics.assigned_staff_count', 0);
});

test('users with deleted account admin assignments cannot view account location dashboards', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();

    $assignment = AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $assignment->delete();

    $this->actingAs($admin)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertForbidden();
});

test('the assigned staff count counts unique users assigned to the location', function () {
    $location = Location::factory()->create();
    $manager = User::factory()->create();
    $frontDesk = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('metrics.assigned_staff_count', 2);
});

test('the assigned staff count ignores deleted assignments', function () {
    $location = Location::factory()->create();
    $manager = User::factory()->create();
    $deletedStaff = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    $assignment = LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $deletedStaff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $assignment->delete();

    $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('metrics.assigned_staff_count', 1);
});
