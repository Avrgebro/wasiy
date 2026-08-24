<?php

use App\Enums\LocationType;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

test('the single address column is replaced by components', function () {
    expect(Schema::hasColumn('locations', 'address'))->toBeFalse()
        ->and(Schema::hasColumns('locations', [
            'type', 'address_line1', 'address_line2', 'district', 'city',
            'state', 'postal_code', 'country', 'phone', 'contact_email',
            'access_notes', 'deactivated_at', 'deactivated_by_user_id', 'settings',
        ]))->toBeTrue();
});

test('formatted address omits absent components without stray separators', function () {
    $location = Location::factory()->create([
        'address_line1' => 'Av. Javier Prado Este 123',
        'district' => 'San Isidro',
        'city' => 'Lima',
    ]);

    expect($location->formattedAddress())->toBe('Av. Javier Prado Este 123, San Isidro, Lima');

    $location->forceFill(['district' => null])->save();
    expect($location->formattedAddress())->toBe('Av. Javier Prado Este 123, Lima');

    $location->forceFill(['address_line1' => null, 'city' => null])->save();
    expect($location->formattedAddress())->toBeNull();
});

test('active excludes deactivated rows and deactivated is its complement', function () {
    $active = Location::factory()->create();
    $retired = Location::factory()->for($active->account)->create();
    $retired->deactivate(User::factory()->create());

    expect(Location::query()->active()->pluck('id')->all())->toBe([$active->id])
        ->and(Location::query()->deactivated()->pluck('id')->all())->toBe([$retired->id]);
});

test('deactivate stamps who and when, and reactivate clears both', function () {
    $location = Location::factory()->create();
    $admin = User::factory()->create();

    $location->deactivate($admin);

    expect($location->refresh()->isDeactivated())->toBeTrue()
        ->and($location->deactivated_at)->not->toBeNull()
        ->and($location->deactivatedBy->id)->toBe($admin->id);

    $location->reactivate();

    expect($location->refresh()->isDeactivated())->toBeFalse()
        ->and($location->deactivated_by_user_id)->toBeNull();
});

test('type casts to the enum and an unknown value fails to cast', function () {
    $location = Location::factory()->create(['type' => LocationType::Condominium]);

    expect($location->refresh()->type)->toBe(LocationType::Condominium);

    Location::query()->whereKey($location->id)->update(['type' => 'parking_garage']);
    $location->refresh()->type;
})->throws(ValueError::class);

test('deactivation is not soft deletion', function () {
    $location = Location::factory()->create();
    $location->deactivate(User::factory()->create());

    expect(Location::query()->find($location->id))->not->toBeNull()
        ->and($location->refresh()->deleted_at)->toBeNull();
});
