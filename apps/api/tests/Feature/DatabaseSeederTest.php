<?php

use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('it seeds the m1 demo account location and location manager assignment', function () {
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $assignment = LocationUserRole::query()
        ->whereBelongsTo($account)
        ->whereBelongsTo($location)
        ->whereBelongsTo($manager)
        ->sole();

    expect($location->account->is($account))->toBeTrue()
        ->and($manager->assignedLocations)->toHaveCount(1)
        ->and($manager->assignedLocations->first()->is($location))->toBeTrue()
        ->and($assignment->role)->toBe(LocationRole::LocationManager);
});
