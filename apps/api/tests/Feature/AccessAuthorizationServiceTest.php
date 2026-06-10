<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('account admins can access any non deleted location in their account', function () {
    $service = app(AccessAuthorizationService::class);
    $admin = User::factory()->create();
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $otherLocation = Location::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    expect($service->canAccessLocation($admin, $firstLocation))->toBeTrue()
        ->and($service->canAccessLocation($admin, $secondLocation))->toBeTrue()
        ->and($service->canAccessLocation($admin, $otherLocation))->toBeFalse()
        ->and($service->accessibleLocationsForAccount($admin, $account)->pluck('id')->all())
        ->toEqualCanonicalizing([$firstLocation->id, $secondLocation->id]);
});

test('operational location access excludes soft deleted locations', function () {
    $service = app(AccessAuthorizationService::class);
    $admin = User::factory()->create();
    $account = Account::factory()->create();
    $deletedLocation = Location::factory()->for($account)->create();
    $activeLocation = Location::factory()->for($account)->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    $deletedLocation->delete();

    expect($service->canAccessLocation($admin, $deletedLocation))->toBeFalse()
        ->and($service->accessibleLocationsForAccount($admin, $account)->pluck('id')->all())
        ->toEqual([$activeLocation->id]);
});

test('account access through location roles excludes soft deleted locations', function () {
    $service = app(AccessAuthorizationService::class);
    $user = User::factory()->create();
    $account = Account::factory()->create();
    $deletedLocation = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $deletedLocation->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $deletedLocation->delete();

    expect($service->canAccessAccount($user, $account))->toBeFalse()
        ->and($service->accessibleAccounts($user)->exists())->toBeFalse();
});

test('location managers and front desk users can access only explicit assigned locations', function () {
    $service = app(AccessAuthorizationService::class);
    $account = Account::factory()->create();
    $manager = User::factory()->create();
    $frontDesk = User::factory()->create();
    $managerLocation = Location::factory()->for($account)->create();
    $frontDeskLocation = Location::factory()->for($account)->create();
    $unassignedLocation = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $managerLocation->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $frontDeskLocation->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    expect($service->canAccessLocation($manager, $managerLocation))->toBeTrue()
        ->and($service->canAccessLocation($manager, $unassignedLocation))->toBeFalse()
        ->and($service->canAccessLocation($frontDesk, $frontDeskLocation))->toBeTrue()
        ->and($service->canAccessLocation($frontDesk, $unassignedLocation))->toBeFalse();
});

test('account admin implicit access is not reported as an explicit location role', function () {
    $service = app(AccessAuthorizationService::class);
    $admin = User::factory()->create();
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    expect($service->canAccessLocation($admin, $location))->toBeTrue()
        ->and($service->hasLocationRole($admin, $location, LocationRole::LocationManager))->toBeFalse()
        ->and($service->hasLocationRole($admin, $location, LocationRole::FrontDesk))->toBeFalse();
});

test('staff management requires explicit account admin role', function () {
    $service = app(AccessAuthorizationService::class);
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $manager = User::factory()->create();
    $frontDesk = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    expect($service->canManageStaff($admin, $account))->toBeTrue()
        ->and($service->canManageStaff($manager, $account))->toBeFalse()
        ->and($service->canManageStaff($frontDesk, $account))->toBeFalse();
});

test('account policy separates broad account visibility from staff management', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $manager = User::factory()->create();
    $frontDesk = User::factory()->create();
    $outsider = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    expect($admin->can('view', $account))->toBeTrue()
        ->and($manager->can('view', $account))->toBeTrue()
        ->and($frontDesk->can('view', $account))->toBeTrue()
        ->and($outsider->can('view', $account))->toBeFalse()
        ->and($admin->can('manageStaff', $account))->toBeTrue()
        ->and($manager->can('manageStaff', $account))->toBeFalse()
        ->and($frontDesk->can('manageStaff', $account))->toBeFalse();
});

test('location policy uses broad location access semantics', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $frontDesk = User::factory()->create();
    $outsider = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    expect($admin->can('view', $location))->toBeTrue()
        ->and($frontDesk->can('view', $location))->toBeTrue()
        ->and($outsider->can('view', $location))->toBeFalse();
});
