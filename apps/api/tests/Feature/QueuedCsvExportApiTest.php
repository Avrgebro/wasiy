<?php

use App\Enums\ActivityEventType;
use App\Enums\ExportStatus;
use App\Enums\ExportType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Enums\VehicleType;
use App\Jobs\GenerateCsvExport;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\RegistryExport;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function createExportManager(Location $location): User
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

test('manager can request units residents export for accessible scope', function () {
    Queue::fake();

    $location = Location::factory()->create();
    $manager = createExportManager($location);

    $response = $this->actingAs($manager)
        ->postJson('/api/exports', [
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'export_type' => ExportType::RegistryUnitsResidents->value,
            'filters' => [
                'status' => RegistryStatus::Active->value,
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.account_id', $location->account_id)
        ->assertJsonPath('data.location_id', $location->id)
        ->assertJsonPath('data.export_type', ExportType::RegistryUnitsResidents->value)
        ->assertJsonPath('data.status', ExportStatus::Pending->value)
        ->assertJsonPath('data.filters.status', RegistryStatus::Active->value);

    $exportId = $response->json('data.id');

    Queue::assertPushed(GenerateCsvExport::class, fn (GenerateCsvExport $job) => $job->export->id === $exportId);

    $this->assertDatabaseHas('activity_logs', [
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'actor_user_id' => $manager->id,
        'subject_type' => RegistryExport::class,
        'subject_id' => $exportId,
        'event_type' => ActivityEventType::ExportRequested->value,
    ]);
});

test('manager cannot export inaccessible location data', function () {
    $account = Location::factory()->create()->account;
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $manager = createExportManager($accessibleLocation);

    $this->actingAs($manager)
        ->postJson('/api/exports', [
            'account_id' => $account->id,
            'location_id' => $inaccessibleLocation->id,
            'export_type' => ExportType::Vehicles->value,
            'filters' => [],
        ])
        ->assertForbidden();

    $this->actingAs($manager)
        ->postJson('/api/exports', [
            'account_id' => $account->id,
            'export_type' => ExportType::Vehicles->value,
            'filters' => [],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_id');
});

test('job writes registry csv with expected spanish headings and rows', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createExportManager($location);
    $unit = Unit::factory()->for($location->account)->for($location)->create([
        'unit_number' => '301',
        'building_name' => 'Torre A',
        'floor' => '3',
    ]);
    $resident = Resident::factory()->for($location->account)->create([
        'first_name' => 'Ana',
        'last_name' => 'Salas',
        'phone' => '999',
        'email' => 'ana@example.test',
    ]);
    UnitMembership::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->for($resident)
        ->primaryContact()
        ->create([
            'resident_type' => ResidentType::Owner,
        ]);

    $export = RegistryExport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'export_type' => ExportType::RegistryUnitsResidents,
            'filters' => ['status' => RegistryStatus::Active->value],
        ]);

    (new GenerateCsvExport($export))->handle();

    $export->refresh();

    expect($export->status)->toBe(ExportStatus::Ready)
        ->and($export->completed_at)->not->toBeNull()
        ->and($export->path)->not->toBeNull();

    Storage::disk('local')->assertExists($export->path);

    $csv = Storage::disk('local')->get($export->path);

    expect($csv)->toContain('Unidad,Edificio,Piso,"Estado de unidad",Residente,"Tipo de residente","Contacto principal","Estado de membresia",Telefono,Email')
        ->and($csv)->toContain('301,"Torre A",3,active,"Ana Salas",owner,Si,active,999,ana@example.test');

    $this->assertDatabaseHas('activity_logs', [
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'actor_user_id' => $manager->id,
        'subject_type' => RegistryExport::class,
        'subject_id' => $export->id,
        'event_type' => ActivityEventType::ExportCompleted->value,
    ]);
});

test('job writes vehicles csv with expected headings and rows', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createExportManager($location);
    $unit = Unit::factory()->for($location->account)->for($location)->create([
        'unit_number' => '401',
        'building_name' => 'Torre B',
        'floor' => null,
    ]);
    Vehicle::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->create([
            'vehicle_type' => VehicleType::Car,
            'plate' => 'ABC-123',
            'make' => 'Toyota',
            'model' => 'Yaris',
            'color' => 'Rojo',
        ]);

    $export = RegistryExport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'export_type' => ExportType::Vehicles,
            'filters' => ['vehicle_type' => VehicleType::Car->value],
        ]);

    (new GenerateCsvExport($export))->handle();

    $export->refresh();
    $csv = Storage::disk('local')->get($export->path);

    expect($export->status)->toBe(ExportStatus::Ready)
        ->and($csv)->toContain('Placa,Tipo,Unidad,Edificio,Piso,Color,Marca,Modelo,Estado')
        ->and($csv)->toContain('ABC-123,car,401,"Torre B",,Rojo,Toyota,Yaris,active');
});

test('download is denied until export is ready', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createExportManager($location);
    $export = RegistryExport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'status' => ExportStatus::Pending,
            'path' => null,
        ]);

    $this->actingAs($manager)
        ->getJson("/api/exports/{$export->id}/download")
        ->assertStatus(409);

    Storage::disk('local')->put('exports/test.csv', "Placa\nABC-123\n");
    $export->forceFill([
        'status' => ExportStatus::Ready,
        'disk' => 'local',
        'path' => 'exports/test.csv',
        'completed_at' => now(),
    ])->save();

    $this->actingAs($manager)
        ->get("/api/exports/{$export->id}/download")
        ->assertOk()
        ->assertHeader('content-disposition');
});
