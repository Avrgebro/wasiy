<?php

use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\StaffLocationRole;
use App\Models\User;
use App\Services\AccessAuthorizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('accounts and locations soft delete while users deactivate', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $user = User::factory()->create();

    $account->delete();
    $location->delete();
    $user->deactivate();

    $this->assertSoftDeleted($account);
    $this->assertSoftDeleted($location);

    expect(Account::query()->find($account->id))->toBeNull()
        ->and(Account::withTrashed()->find($account->id))->not->toBeNull()
        ->and(Location::query()->find($location->id))->toBeNull()
        ->and(Location::withTrashed()->find($location->id))->not->toBeNull()
        ->and(User::query()->find($user->id))->not->toBeNull()
        ->and($user->fresh()->isDeactivated())->toBeTrue();
});

test('archiving a location keeps location role grants for restoration history', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    $membership = grantLocationRole($location->account, $location, $user, LocationRole::LocationManager);
    $roleRow = StaffLocationRole::query()
        ->where('staff_membership_id', $membership->id)
        ->sole();

    $location->delete();

    $this->assertSoftDeleted($location);
    $this->assertDatabaseHas('staff_location_roles', [
        'id' => $roleRow->id,
        'staff_membership_id' => $membership->id,
        'location_id' => $location->id,
    ]);

    // The grant survives for restoration history but stops granting access.
    expect(app(AccessAuthorizationService::class)
        ->canAccessLocation($user->fresh(), $location->fresh()))->toBeFalse();
});

test('permanently deleting a location cascades location role grants', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    $membership = grantLocationRole($location->account, $location, $user, LocationRole::LocationManager);
    $roleRow = StaffLocationRole::query()
        ->where('staff_membership_id', $membership->id)
        ->sole();

    $location->forceDelete();

    $this->assertDatabaseMissing('locations', [
        'id' => $location->id,
    ]);
    $this->assertDatabaseMissing('staff_location_roles', [
        'id' => $roleRow->id,
    ]);
});
