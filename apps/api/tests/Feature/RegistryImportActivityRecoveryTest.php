<?php

use App\Enums\ActivityEventType;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Jobs\CommitRegistryImport;
use App\Jobs\ValidateRegistryImport;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function createImportRecoveryManager(Location $location): User
{
    $manager = User::factory()->create();

    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);

    return $manager;
}

function createImportRecoveryReadyImport(Location $location, User $requestedBy, array $attributes = []): RegistryImport
{
    return RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->for($requestedBy, 'requestedBy')
        ->create([
            'status' => ImportStatus::ReadyForReview,
            'confirmed_at' => now(),
            'import_type' => ImportType::RegistryUnitsResidents,
            'total_rows' => 0,
            'valid_rows' => 0,
            'error_rows' => 0,
            'duplicate_rows' => 0,
            'warning_rows' => 0,
            ...$attributes,
        ]);
}

function createImportRecoveryRow(RegistryImport $import, array $normalizedData, array $attributes = []): RegistryImportRow
{
    return RegistryImportRow::factory()
        ->for($import)
        ->for($import->account)
        ->for($import->location)
        ->create([
            'row_number' => $attributes['row_number'] ?? 2,
            'status' => $attributes['status'] ?? ImportRowStatus::Valid,
            'raw_data' => $attributes['raw_data'] ?? [],
            'normalized_data' => [
                'unit_number' => null,
                'building_name' => null,
                'floor' => null,
                'first_name' => null,
                'last_name' => null,
                'phone' => null,
                'email' => null,
                'resident_type' => null,
                'is_primary_contact' => false,
                'membership_status' => RegistryStatus::Active->value,
                'unit_notes' => null,
                ...$normalizedData,
            ],
            'errors' => $attributes['errors'] ?? [],
            'warnings' => $attributes['warnings'] ?? [],
            'duplicate_key' => $attributes['duplicate_key'] ?? null,
        ]);
}

test('uploaded import logs compact activity metadata', function () {
    Queue::fake();
    Storage::fake('local');
    config(['wasiy.imports.disk' => 'local']);

    $location = Location::factory()->create();
    $manager = createImportRecoveryManager($location);

    $response = $this->actingAs($manager)
        ->post("/api/locations/{$location->id}/registry-imports", [
            'file' => UploadedFile::fake()->createWithContent('registro.csv', "unidad\n301\n"),
            'import_type' => ImportType::RegistryUnitsResidents->value,
        ])
        ->assertCreated();

    $importId = $response->json('data.id');
    $log = ActivityLog::query()
        ->where('event_type', ActivityEventType::ImportUploaded)
        ->where('subject_id', $importId)
        ->sole();

    expect($log->summary)->toBe('Importacion CSV cargada.')
        ->and($log->account_id)->toBe($location->account_id)
        ->and($log->location_id)->toBe($location->id)
        ->and($log->actor_user_id)->toBe($manager->id)
        ->and($log->metadata)->toMatchArray([
            'import_id' => $importId,
            'import_type' => ImportType::RegistryUnitsResidents->value,
            'filename' => 'registro.csv',
            'location_id' => $location->id,
            'total_rows' => 0,
            'valid_rows' => 0,
            'error_rows' => 0,
            'duplicate_rows' => 0,
            'warning_rows' => 0,
            'actor_user_id' => $manager->id,
        ]);
});

test('failed validation logs activity and keeps failure visible', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createImportRecoveryManager($location);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'disk' => 'local',
            'path' => 'imports/missing.csv',
        ]);

    (new ValidateRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Failed)
        ->and($import->failure_reason)->toBe('No se pudo leer el archivo CSV almacenado.');

    $log = ActivityLog::query()
        ->where('event_type', ActivityEventType::ImportValidationFailed)
        ->where('subject_id', $import->id)
        ->sole();

    expect($log->summary)->toBe('Validacion de importacion CSV fallida.')
        ->and($log->actor_user_id)->toBe($manager->id)
        ->and($log->metadata['failure_reason'])->toBe('No se pudo leer el archivo CSV almacenado.');
});

test('completed import logs activity with counters and created ids', function () {
    $location = Location::factory()->create();
    $manager = createImportRecoveryManager($location);
    $import = createImportRecoveryReadyImport($location, $manager, [
        'total_rows' => 2,
        'valid_rows' => 1,
        'duplicate_rows' => 1,
    ]);
    createImportRecoveryRow($import, [
        'unit_number' => '301',
        'building_name' => 'Torre A',
        'first_name' => 'Ana',
        'last_name' => 'Salas',
        'email' => 'ana@example.test',
        'resident_type' => ResidentType::Owner->value,
        'is_primary_contact' => true,
    ], ['row_number' => 2]);
    createImportRecoveryRow($import, [
        'unit_number' => '301',
        'building_name' => 'Torre A',
    ], [
        'row_number' => 3,
        'status' => ImportRowStatus::Duplicate,
        'duplicate_key' => 'unit-row:torre a:301',
    ]);

    (new CommitRegistryImport($import))->handle();

    $import->refresh();
    $unit = Unit::query()->where('unit_number', '301')->sole();
    $resident = Resident::query()->where('email', 'ana@example.test')->sole();
    $membership = UnitMembership::query()->where('resident_id', $resident->id)->sole();

    $log = ActivityLog::query()
        ->where('event_type', ActivityEventType::ImportCompleted)
        ->where('subject_id', $import->id)
        ->sole();

    expect($import->status)->toBe(ImportStatus::Completed)
        ->and($log->summary)->toBe('Importacion CSV completada.')
        ->and($log->metadata)->toMatchArray([
            'import_id' => $import->id,
            'import_type' => ImportType::RegistryUnitsResidents->value,
            'filename' => 'registro-importacion.csv',
            'location_id' => $location->id,
            'total_rows' => 2,
            'valid_rows' => 1,
            'error_rows' => 0,
            'duplicate_rows' => 1,
            'warning_rows' => 0,
            'actor_user_id' => $manager->id,
            'created_unit_ids' => [$unit->id],
            'created_resident_ids' => [$resident->id],
            'created_unit_membership_ids' => [$membership->id],
        ]);
});

test('failed commit logs activity and keeps failure visible', function () {
    $location = Location::factory()->create();
    $manager = createImportRecoveryManager($location);
    $import = createImportRecoveryReadyImport($location, $manager, [
        'total_rows' => 1,
        'valid_rows' => 1,
    ]);
    createImportRecoveryRow($import, [
        'unit_number' => null,
    ]);

    (new CommitRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Failed)
        ->and($import->failed_at)->not->toBeNull()
        ->and($import->failure_reason)->not->toBeNull();

    $log = ActivityLog::query()
        ->where('event_type', ActivityEventType::ImportFailed)
        ->where('subject_id', $import->id)
        ->sole();

    expect($log->summary)->toBe('Importacion CSV fallida.')
        ->and($log->actor_user_id)->toBe($manager->id)
        ->and($log->metadata['failure_reason'])->toBe($import->failure_reason);
});

test('failed validation retry requeues validation and clears stale failure fields', function () {
    Queue::fake();
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createImportRecoveryManager($location);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'status' => ImportStatus::Failed,
            'disk' => 'local',
            'path' => 'imports/retry.csv',
            'failed_at' => now(),
            'failure_reason' => 'Fallo anterior.',
            'confirmed_at' => null,
        ]);

    Storage::disk('local')->put($import->path, "unidad\n301\n");

    $this->actingAs($manager)
        ->postJson("/api/registry-imports/{$import->id}/retry")
        ->assertOk()
        ->assertJsonPath('data.status', ImportStatus::Pending->value)
        ->assertJsonPath('data.failure_reason', null)
        ->assertJsonPath('data.failed_at', null);

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Pending)
        ->and($import->failed_at)->toBeNull()
        ->and($import->failure_reason)->toBeNull();

    Queue::assertPushed(ValidateRegistryImport::class, fn (ValidateRegistryImport $job) => $job->import->id === $import->id);
});

test('retry rejects failed commit imports without dispatching or logging activity', function () {
    Queue::fake();
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createImportRecoveryManager($location);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'status' => ImportStatus::Failed,
            'disk' => 'local',
            'path' => 'imports/commit-failed.csv',
            'failed_at' => now(),
            'failure_reason' => 'Fallo de confirmacion.',
            'confirmed_at' => now(),
        ]);
    $activityCount = ActivityLog::query()->count();

    $this->actingAs($manager)
        ->postJson("/api/registry-imports/{$import->id}/retry")
        ->assertUnprocessable();

    Queue::assertNotPushed(ValidateRegistryImport::class);
    expect(ActivityLog::query()->count())->toBe($activityCount);
});
