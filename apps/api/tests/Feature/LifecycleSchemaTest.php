<?php

use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
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

    $assignment = LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $location->delete();

    $this->assertSoftDeleted($location);
    $this->assertDatabaseHas('location_user_roles', [
        'id' => $assignment->id,
        'location_id' => $location->id,
        'user_id' => $user->id,
    ]);

    expect($user->fresh()->locationUserRoles)->toHaveCount(0);
});

test('permanently deleting a location cascades location role grants', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    $assignment = LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => LocationRole::LocationManager,
    ]);

    $location->forceDelete();

    $this->assertDatabaseMissing('locations', [
        'id' => $location->id,
    ]);
    $this->assertDatabaseMissing('location_user_roles', [
        'id' => $assignment->id,
    ]);
});
