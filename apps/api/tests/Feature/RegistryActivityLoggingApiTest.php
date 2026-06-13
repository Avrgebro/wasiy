<?php

use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\ResidentType;
use App\Enums\VehicleType;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createRegistryActivityManager(Location $location): User
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

test('unit create update and inactivate log activity and no-op update does not', function () {
    $location = Location::factory()->create();
    $manager = createRegistryActivityManager($location);

    $response = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/units", [
            'unit_number' => '301',
            'building_name' => 'Torre A',
        ])
        ->assertCreated();

    $unitId = $response->json('data.id');

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::UnitCreated->value,
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'actor_user_id' => $manager->id,
        'subject_type' => Unit::class,
        'subject_id' => $unitId,
    ]);

    $this->actingAs($manager)
        ->patchJson("/api/units/{$unitId}", [
            'unit_number' => '302',
        ])
        ->assertOk();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::UnitUpdated->value,
        'subject_type' => Unit::class,
        'subject_id' => $unitId,
    ]);

    $countAfterUpdate = ActivityLog::query()->count();

    $this->actingAs($manager)
        ->patchJson("/api/units/{$unitId}", [
            'unit_number' => '302',
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe($countAfterUpdate);

    $unit = Unit::query()->findOrFail($unitId);
    $resident = Resident::factory()->for($unit->account)->create();
    UnitMembership::factory()
        ->for($unit->account)
        ->for($unit->location)
        ->for($unit)
        ->for($resident)
        ->create();

    $this->actingAs($manager)
        ->deleteJson("/api/units/{$unitId}")
        ->assertOk();

    $log = ActivityLog::query()
        ->where('event_type', ActivityEventType::UnitInactivated)
        ->where('subject_id', $unitId)
        ->sole();

    expect($log->summary)->toContain('Unidad')
        ->and($log->metadata['unit_label'])->toBe('302');
});

test('resident create update and inactivate log activity and no-op update does not', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $manager = createRegistryActivityManager($location);

    $response = $this->actingAs($manager)
        ->postJson("/api/accounts/{$location->account_id}/residents", [
            'first_name' => 'Ana',
            'last_name' => 'Salas',
            'email' => 'ana@example.test',
            'memberships' => [[
                'unit_id' => $unit->id,
                'resident_type' => ResidentType::Owner->value,
                'is_primary_contact' => true,
            ]],
        ])
        ->assertCreated();

    $residentId = $response->json('data.id');

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::ResidentCreated->value,
        'account_id' => $location->account_id,
        'actor_user_id' => $manager->id,
        'subject_type' => Resident::class,
        'subject_id' => $residentId,
    ]);

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::UnitMembershipPrimaryContactChanged->value,
        'location_id' => $location->id,
    ]);

    $this->actingAs($manager)
        ->patchJson("/api/residents/{$residentId}", [
            'phone' => '999',
        ])
        ->assertOk();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::ResidentUpdated->value,
        'subject_type' => Resident::class,
        'subject_id' => $residentId,
    ]);

    $countAfterUpdate = ActivityLog::query()->count();

    $this->actingAs($manager)
        ->patchJson("/api/residents/{$residentId}", [
            'phone' => '999',
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe($countAfterUpdate);

    $this->actingAs($manager)
        ->deleteJson("/api/residents/{$residentId}")
        ->assertOk();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::ResidentInactivated->value,
        'subject_type' => Resident::class,
        'subject_id' => $residentId,
    ]);
});

test('membership changes log activity with resident and unit labels', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create([
        'unit_number' => '401',
        'building_name' => 'Torre B',
    ]);
    $resident = Resident::factory()->for($location->account)->create([
        'first_name' => 'Luis',
        'last_name' => 'Diaz',
    ]);
    $manager = createRegistryActivityManager($location);

    $response = $this->actingAs($manager)
        ->postJson("/api/residents/{$resident->id}/memberships", [
            'unit_id' => $unit->id,
            'resident_type' => ResidentType::Tenant->value,
        ])
        ->assertCreated();

    $membershipId = $response->json('data.id');

    $log = ActivityLog::query()
        ->where('event_type', ActivityEventType::UnitMembershipCreated)
        ->where('subject_id', $membershipId)
        ->sole();

    expect($log->metadata['resident_name'])->toBe('Luis Diaz')
        ->and($log->metadata['unit_label'])->toBe('Torre B / 401');

    $this->actingAs($manager)
        ->patchJson("/api/unit-memberships/{$membershipId}", [
            'resident_type' => ResidentType::Occupant->value,
        ])
        ->assertOk();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::UnitMembershipUpdated->value,
        'subject_type' => UnitMembership::class,
        'subject_id' => $membershipId,
    ]);

    $this->actingAs($manager)
        ->deleteJson("/api/unit-memberships/{$membershipId}")
        ->assertOk();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::UnitMembershipInactivated->value,
        'subject_type' => UnitMembership::class,
        'subject_id' => $membershipId,
    ]);
});

test('primary contact replacement logs one meaningful event', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $firstResident = Resident::factory()->for($location->account)->create();
    $secondResident = Resident::factory()->for($location->account)->create();
    UnitMembership::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->for($firstResident)
        ->primaryContact()
        ->create();
    $replacement = UnitMembership::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->for($secondResident)
        ->create();
    $manager = createRegistryActivityManager($location);

    $countBefore = ActivityLog::query()->count();

    $this->actingAs($manager)
        ->patchJson("/api/unit-memberships/{$replacement->id}", [
            'is_primary_contact' => true,
        ])
        ->assertOk();

    $logs = ActivityLog::query()
        ->where('event_type', ActivityEventType::UnitMembershipPrimaryContactChanged)
        ->get();

    expect(ActivityLog::query()->count() - $countBefore)->toBe(1)
        ->and($logs)->toHaveCount(1)
        ->and($logs->first()->metadata['unit_id'])->toBe($unit->id)
        ->and($logs->first()->metadata['new_primary_membership_id'])->toBe($replacement->id);
});

test('vehicle changes log activity', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $manager = createRegistryActivityManager($location);

    $response = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/vehicles", [
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'ABC-123',
        ])
        ->assertCreated();

    $vehicleId = $response->json('data.id');

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::VehicleCreated->value,
        'location_id' => $location->id,
        'subject_type' => Vehicle::class,
        'subject_id' => $vehicleId,
    ]);

    $this->actingAs($manager)
        ->patchJson("/api/vehicles/{$vehicleId}", [
            'plate' => 'XYZ-987',
        ])
        ->assertOk();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::VehicleUpdated->value,
        'subject_type' => Vehicle::class,
        'subject_id' => $vehicleId,
    ]);

    $countAfterUpdate = ActivityLog::query()->count();

    $this->actingAs($manager)
        ->patchJson("/api/vehicles/{$vehicleId}", [
            'plate' => 'XYZ-987',
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe($countAfterUpdate);

    $this->actingAs($manager)
        ->deleteJson("/api/vehicles/{$vehicleId}")
        ->assertNoContent();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::VehicleDeleted->value,
        'subject_type' => Vehicle::class,
        'subject_id' => $vehicleId,
    ]);
});
