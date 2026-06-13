<?php

use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Enums\VehicleType;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a resident can belong to multiple units', function () {
    $location = Location::factory()->create();
    $resident = Resident::factory()->for($location->account)->create();
    $units = Unit::factory()
        ->count(2)
        ->for($location->account)
        ->for($location)
        ->create();

    UnitMembership::factory()
        ->for($resident)
        ->for($units[0])
        ->for($location->account)
        ->for($location)
        ->create();
    UnitMembership::factory()
        ->for($resident)
        ->for($units[1])
        ->for($location->account)
        ->for($location)
        ->create();

    expect($resident->unitMemberships()->count())->toBe(2)
        ->and($resident->units()->pluck('units.id')->all())->toEqualCanonicalizing($units->pluck('id')->all());
});

test('a unit cannot have more than one active primary contact', function () {
    $unit = Unit::factory()->create();
    $resident = Resident::factory()->for($unit->account)->create();
    $otherResident = Resident::factory()->for($unit->account)->create();

    UnitMembership::factory()
        ->for($unit)
        ->for($resident)
        ->for($unit->account)
        ->for($unit->location)
        ->primaryContact()
        ->create();

    expect(fn () => UnitMembership::factory()
        ->for($unit)
        ->for($otherResident)
        ->for($unit->account)
        ->for($unit->location)
        ->primaryContact()
        ->create())->toThrow(QueryException::class);
});

test('inactive unit memberships cannot be primary contact', function () {
    expect(fn () => UnitMembership::factory()
        ->inactive()
        ->primaryContact()
        ->create())->toThrow(QueryException::class);
});

test('setting a new primary contact clears the previous primary contact', function () {
    $unit = Unit::factory()->create();
    $resident = Resident::factory()->for($unit->account)->create();
    $otherResident = Resident::factory()->for($unit->account)->create();
    $previous = UnitMembership::factory()
        ->for($unit)
        ->for($resident)
        ->for($unit->account)
        ->for($unit->location)
        ->primaryContact()
        ->create();
    $next = UnitMembership::factory()
        ->for($unit)
        ->for($otherResident)
        ->for($unit->account)
        ->for($unit->location)
        ->create();

    $next->markAsPrimaryContact();

    expect($previous->fresh()->is_primary_contact)->toBeFalse()
        ->and($next->fresh()->is_primary_contact)->toBeTrue();
});

test('vehicle unit location and account scope cannot drift', function () {
    $unit = Unit::factory()->create();
    $otherLocation = Location::factory()->for($unit->account)->create();
    $otherAccountLocation = Location::factory()->create();

    expect(fn () => Vehicle::factory()
        ->for($unit)
        ->for($unit->account)
        ->for($otherLocation, 'location')
        ->create())->toThrow(QueryException::class);

    expect(fn () => Vehicle::factory()
        ->for($unit)
        ->for($otherAccountLocation->account)
        ->for($unit->location)
        ->create())->toThrow(QueryException::class);
});

test('resident user id cannot be linked to multiple residents', function () {
    $user = User::factory()->create();

    Resident::factory()->for($user)->create();

    expect(fn () => Resident::factory()->for($user)->create())->toThrow(QueryException::class);
});

test('registry models cast enum values', function () {
    $membership = UnitMembership::factory()->create([
        'resident_type' => ResidentType::Tenant,
    ]);
    $vehicle = Vehicle::factory()->for($membership->unit)->create([
        'account_id' => $membership->account_id,
        'location_id' => $membership->location_id,
        'vehicle_type' => VehicleType::Motorcycle,
        'status' => RegistryStatus::Inactive,
    ]);

    expect($membership->fresh()->resident_type)->toBe(ResidentType::Tenant)
        ->and($membership->fresh()->status)->toBe(RegistryStatus::Active)
        ->and($vehicle->fresh()->vehicle_type)->toBe(VehicleType::Motorcycle)
        ->and($vehicle->fresh()->status)->toBe(RegistryStatus::Inactive);
});
