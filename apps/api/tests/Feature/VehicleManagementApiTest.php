<?php

use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\VehicleType;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createVehicleManager(Location $location): User
{
    $manager = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    return $manager;
}

function createResidentUserForUnit(Unit $unit): User
{
    $user = User::factory()->create();
    $resident = Resident::factory()->for($unit->account)->for($user)->create();

    UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($unit->account)
        ->for($unit->location)
        ->create();

    return $user;
}

test('manager can create and edit vehicle for accessible unit', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $newUnit = Unit::factory()->for($location->account)->for($location)->create();
    $manager = createVehicleManager($location);

    $createResponse = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/vehicles", [
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'ABC-123',
            'make' => 'Toyota',
            'model' => 'Yaris',
            'color' => 'Rojo',
            'notes' => 'Estaciona en sótano',
        ])
        ->assertCreated()
        ->assertJsonPath('data.account_id', $location->account_id)
        ->assertJsonPath('data.location_id', $location->id)
        ->assertJsonPath('data.unit_id', $unit->id)
        ->assertJsonPath('data.plate', 'ABC-123')
        ->assertJsonPath('data.status', RegistryStatus::Active->value);

    $vehicleId = $createResponse->json('data.id');

    $this->actingAs($manager)
        ->patchJson("/api/vehicles/{$vehicleId}", [
            'unit_id' => $newUnit->id,
            'vehicle_type' => VehicleType::Motorcycle->value,
            'plate' => 'XYZ-987',
            'status' => RegistryStatus::Inactive->value,
        ])
        ->assertOk()
        ->assertJsonPath('data.unit_id', $newUnit->id)
        ->assertJsonPath('data.vehicle_type', VehicleType::Motorcycle->value)
        ->assertJsonPath('data.plate', 'XYZ-987')
        ->assertJsonPath('data.status', RegistryStatus::Inactive->value);
});

test('manager cannot create vehicle for inaccessible unit', function () {
    $account = Location::factory()->create()->account;
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleUnit = Unit::factory()->for($account)->for($inaccessibleLocation)->create();
    $manager = createVehicleManager($accessibleLocation);

    $this->actingAs($manager)
        ->postJson("/api/locations/{$inaccessibleLocation->id}/vehicles", [
            'unit_id' => $inaccessibleUnit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'BAD-001',
        ])
        ->assertForbidden();

    $this->actingAs($manager)
        ->postJson("/api/locations/{$accessibleLocation->id}/vehicles", [
            'unit_id' => $inaccessibleUnit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'BAD-002',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');
});

test('manager list supports location unit type status plate and search filters', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $otherUnit = Unit::factory()->for($location->account)->for($location)->create();
    $visibleVehicle = Vehicle::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->create([
            'vehicle_type' => VehicleType::Car,
            'plate' => 'ABC-123',
            'make' => 'Toyota',
            'status' => RegistryStatus::Active,
        ]);
    Vehicle::factory()->for($location->account)->for($location)->for($otherUnit)->create([
        'vehicle_type' => VehicleType::Bicycle,
        'plate' => 'BIKE-1',
    ]);
    Vehicle::factory()->for($location->account)->for($location)->for($unit)->inactive()->create([
        'plate' => 'OLD-1',
    ]);
    $manager = createVehicleManager($location);

    $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/vehicles?unit_id={$unit->id}&vehicle_type=car&status=active&plate=ABC-123&search=toyota")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $visibleVehicle->id)
        ->assertJsonPath('data.0.unit.id', $unit->id);
});

test('resident can create vehicle for active unit membership', function () {
    $unit = Unit::factory()->create();
    $residentUser = createResidentUserForUnit($unit);

    $this->actingAs($residentUser)
        ->postJson('/api/portal/vehicles', [
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'RES-123',
            'color' => 'Azul',
        ])
        ->assertCreated()
        ->assertJsonPath('data.account_id', $unit->account_id)
        ->assertJsonPath('data.location_id', $unit->location_id)
        ->assertJsonPath('data.unit_id', $unit->id)
        ->assertJsonPath('data.plate', 'RES-123');
});

test('resident cannot update another units vehicle', function () {
    $unit = Unit::factory()->create();
    $otherUnit = Unit::factory()->for($unit->account)->for($unit->location)->create();
    $residentUser = createResidentUserForUnit($unit);
    $otherVehicle = Vehicle::factory()->for($otherUnit)->for($unit->account)->for($unit->location)->create();

    $this->actingAs($residentUser)
        ->patchJson("/api/portal/vehicles/{$otherVehicle->id}", [
            'plate' => 'NOPE-1',
        ])
        ->assertForbidden();
});

test('vehicle account location and unit scope is enforced on create and update', function () {
    $unit = Unit::factory()->create();
    $otherLocation = Location::factory()->for($unit->account)->create();
    $otherLocationUnit = Unit::factory()->for($unit->account)->for($otherLocation)->create();
    $residentUser = createResidentUserForUnit($unit);
    $vehicle = Vehicle::factory()->for($unit)->for($unit->account)->for($unit->location)->create();

    $this->actingAs($residentUser)
        ->postJson('/api/portal/vehicles', [
            'unit_id' => $otherLocationUnit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'BAD-003',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');

    $this->actingAs($residentUser)
        ->patchJson("/api/portal/vehicles/{$vehicle->id}", [
            'unit_id' => $otherLocationUnit->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');
});

test('resident cannot create vehicle for inactive unit or inactive membership', function () {
    $unit = Unit::factory()->create();
    $residentUser = createResidentUserForUnit($unit);

    $unit->forceFill(['status' => RegistryStatus::Inactive])->save();

    $this->actingAs($residentUser)
        ->postJson('/api/portal/vehicles', [
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');

    $unit->forceFill(['status' => RegistryStatus::Active])->save();
    UnitMembership::query()->where('unit_id', $unit->id)->update(['status' => RegistryStatus::Inactive->value]);

    $this->actingAs($residentUser)
        ->postJson('/api/portal/vehicles', [
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');
});
