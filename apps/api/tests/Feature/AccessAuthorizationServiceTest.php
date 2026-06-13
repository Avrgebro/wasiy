<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
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

test('staff membership uses the same soft delete semantics as account access', function () {
    $service = app(AccessAuthorizationService::class);
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $orphanedStaff = User::factory()->create();
    $outsider = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $orphanedStaff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    expect($service->isStaffForAccount($admin, $account))->toBeTrue()
        ->and($service->isStaffForAccount($orphanedStaff, $account))->toBeTrue()
        ->and($service->isStaffForAccount($outsider, $account))->toBeFalse()
        ->and($service->staffForAccount($account)->pluck('id')->all())
        ->toEqualCanonicalizing([$admin->id, $orphanedStaff->id]);

    $location->delete();

    expect($service->isStaffForAccount($orphanedStaff, $account))->toBeFalse()
        ->and($service->staffForAccount($account)->pluck('id')->all())
        ->toEqual([$admin->id]);
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

test('account admins can manage registry records in any location in their account', function () {
    $service = app(AccessAuthorizationService::class);
    $account = Account::factory()->create();
    $admin = User::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $otherLocation = Location::factory()->create();
    $unit = Unit::factory()->for($account)->for($secondLocation)->create();
    $resident = Resident::factory()->for($account)->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    expect($service->canManageRegistry($admin, $firstLocation))->toBeTrue()
        ->and($service->canManageRegistry($admin, $secondLocation))->toBeTrue()
        ->and($service->canManageRegistry($admin, $otherLocation))->toBeFalse()
        ->and($service->canManageUnit($admin, $unit))->toBeTrue()
        ->and($service->canManageResidentInLocation($admin, $resident, $firstLocation))->toBeTrue()
        ->and($admin->can('update', $unit))->toBeTrue()
        ->and($admin->can('updateInLocation', [$resident, $firstLocation]))->toBeTrue();
});

test('location managers can manage registry records only in accessible locations', function () {
    $service = app(AccessAuthorizationService::class);
    $account = Account::factory()->create();
    $manager = User::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $accessibleUnit = Unit::factory()->for($account)->for($accessibleLocation)->create();
    $inaccessibleUnit = Unit::factory()->for($account)->for($inaccessibleLocation)->create();
    $resident = Resident::factory()->for($account)->create();
    UnitMembership::factory()
        ->for($resident)
        ->for($accessibleUnit)
        ->for($account)
        ->for($accessibleLocation)
        ->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $accessibleLocation->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    expect($service->canManageRegistry($manager, $accessibleLocation))->toBeTrue()
        ->and($service->canManageRegistry($manager, $inaccessibleLocation))->toBeFalse()
        ->and($service->canManageUnit($manager, $accessibleUnit))->toBeTrue()
        ->and($service->canManageUnit($manager, $inaccessibleUnit))->toBeFalse()
        ->and($service->canManageResidentInLocation($manager, $resident, $accessibleLocation))->toBeTrue()
        ->and($service->canManageResidentInLocation($manager, $resident, $inaccessibleLocation))->toBeFalse()
        ->and($manager->can('create', [Unit::class, $accessibleLocation]))->toBeTrue()
        ->and($manager->can('create', [Unit::class, $inaccessibleLocation]))->toBeFalse();
});

test('location managers cannot create memberships in inaccessible locations', function () {
    $account = Account::factory()->create();
    $manager = User::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $accessibleLocation->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    expect($manager->can('create', [UnitMembership::class, $accessibleLocation]))->toBeTrue()
        ->and($manager->can('create', [UnitMembership::class, $inaccessibleLocation]))->toBeFalse();
});

test('front desk can view registry context but cannot mutate registry records', function () {
    $service = app(AccessAuthorizationService::class);
    $account = Account::factory()->create();
    $frontDesk = User::factory()->create();
    $location = Location::factory()->for($account)->create();
    $unit = Unit::factory()->for($account)->for($location)->create();
    $vehicle = Vehicle::factory()->for($unit)->for($account)->for($location)->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    expect($service->canViewRegistry($frontDesk, $location))->toBeTrue()
        ->and($service->canManageRegistry($frontDesk, $location))->toBeFalse()
        ->and($frontDesk->can('view', $unit))->toBeTrue()
        ->and($frontDesk->can('update', $unit))->toBeFalse()
        ->and($frontDesk->can('delete', $vehicle))->toBeFalse();
});

test('resident portal access requires an active linked resident with active memberships', function () {
    $service = app(AccessAuthorizationService::class);
    $user = User::factory()->create();
    $unit = Unit::factory()->create();
    $resident = Resident::factory()->for($unit->account)->for($user)->create();
    $membership = UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($unit->account)
        ->for($unit->location)
        ->create();

    expect($service->residentForUser($user)?->is($resident))->toBeTrue()
        ->and($service->activeResidentMembershipsForUser($user)->pluck('id')->all())->toEqual([$membership->id])
        ->and($service->canResidentAccessUnit($user, $unit))->toBeTrue();

    $membership->forceFill(['status' => RegistryStatus::Inactive])->save();

    expect($service->activeResidentMembershipsForUser($user)->exists())->toBeFalse()
        ->and($service->canResidentAccessUnit($user, $unit))->toBeFalse();

    $membership->forceFill(['status' => RegistryStatus::Active])->save();
    $resident->forceFill(['status' => RegistryStatus::Inactive])->save();

    expect($service->residentForUser($user))->toBeNull()
        ->and($service->activeResidentMembershipsForUser($user)->exists())->toBeFalse()
        ->and($service->canResidentAccessUnit($user, $unit))->toBeFalse();
});

test('resident users cannot mutate memberships or another units vehicles', function () {
    $residentUser = User::factory()->create();
    $otherResidentUser = User::factory()->create();
    $unit = Unit::factory()->create();
    $resident = Resident::factory()->for($unit->account)->for($residentUser)->create();
    $otherResident = Resident::factory()->for($unit->account)->for($otherResidentUser)->create();
    $membership = UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($unit->account)
        ->for($unit->location)
        ->create();
    $vehicle = Vehicle::factory()->for($unit)->for($unit->account)->for($unit->location)->create();
    $otherUnit = Unit::factory()->for($unit->account)->for($unit->location)->create();
    UnitMembership::factory()
        ->for($otherResident)
        ->for($otherUnit)
        ->for($unit->account)
        ->for($unit->location)
        ->create();
    $otherVehicle = Vehicle::factory()->for($otherUnit)->for($unit->account)->for($unit->location)->create();

    expect($residentUser->can('update', $membership))->toBeFalse()
        ->and($residentUser->can('update', $vehicle))->toBeTrue()
        ->and($residentUser->can('delete', $vehicle))->toBeTrue()
        ->and($residentUser->can('update', $otherVehicle))->toBeFalse()
        ->and($residentUser->can('updatePortalPhone', $resident))->toBeTrue()
        ->and($residentUser->can('updatePortalPhone', $otherResident))->toBeFalse();
});
