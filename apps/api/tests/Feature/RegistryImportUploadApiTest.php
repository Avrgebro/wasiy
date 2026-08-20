<?php

use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Enums\LocationRole;
use App\Jobs\ValidateRegistryImport;
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

function createRegistryImportManager(Location $location): User
{
    $manager = User::factory()->create();

    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);

    return $manager;
}

test('manager can upload registry csv for accessible location', function () {
    Queue::fake();
    Storage::fake('local');
    config(['wasiy.imports.disk' => 'local']);

    $location = Location::factory()->create();
    $manager = createRegistryImportManager($location);
    $file = UploadedFile::fake()->createWithContent('registro.csv', "unidad\n301\n");

    $response = $this->actingAs($manager)
        ->post("/api/locations/{$location->id}/registry-imports", [
            'file' => $file,
            'import_type' => ImportType::RegistryUnitsResidents->value,
        ])
        ->assertCreated()
        ->assertJsonPath('data.account_id', $location->account_id)
        ->assertJsonPath('data.location_id', $location->id)
        ->assertJsonPath('data.import_type', ImportType::RegistryUnitsResidents->value)
        ->assertJsonPath('data.status', ImportStatus::Pending->value)
        ->assertJsonPath('data.original_filename', 'registro.csv')
        ->assertJsonPath('data.total_rows', 0);

    $import = RegistryImport::query()->findOrFail($response->json('data.id'));

    expect($import->requested_by_user_id)->toBe($manager->id)
        ->and($import->disk)->toBe('local')
        ->and($import->path)->not->toBeNull();

    Storage::disk('local')->assertExists($import->path);
    Queue::assertPushed(ValidateRegistryImport::class, fn (ValidateRegistryImport $job) => $job->import->id === $import->id);
});

test('manager cannot upload registry csv for inaccessible location and front desk cannot upload', function () {
    Storage::fake('local');

    $account = Location::factory()->create()->account;
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $manager = createRegistryImportManager($accessibleLocation);
    $frontDesk = User::factory()->create();

    grantLocationRole($account, $accessibleLocation, $frontDesk, LocationRole::FrontDesk);

    $payload = [
        'file' => UploadedFile::fake()->createWithContent('registro.csv', "unidad\n301\n"),
        'import_type' => ImportType::RegistryUnitsResidents->value,
    ];

    $this->actingAs($manager)
        ->post("/api/locations/{$inaccessibleLocation->id}/registry-imports", $payload)
        ->assertForbidden();

    $this->actingAs($frontDesk)
        ->post("/api/locations/{$accessibleLocation->id}/registry-imports", $payload)
        ->assertForbidden();
});

test('registry csv upload validates file type size and import type', function () {
    Storage::fake('local');
    config(['wasiy.imports.max_file_kb' => 1]);

    $location = Location::factory()->create();
    $manager = createRegistryImportManager($location);

    $this->actingAs($manager)
        ->post("/api/locations/{$location->id}/registry-imports", [
            'file' => UploadedFile::fake()->createWithContent('registro.exe', 'bad'),
            'import_type' => 'unknown',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file', 'import_type']);

    $this->actingAs($manager)
        ->post("/api/locations/{$location->id}/registry-imports", [
            'file' => UploadedFile::fake()->create('registro.csv', 2, 'text/csv'),
            'import_type' => ImportType::RegistryUnitsResidents->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');
});

test('validation job writes preview rows and counters without creating registry records', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $manager = createRegistryImportManager($location);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'disk' => 'local',
            'path' => 'imports/test/registro.csv',
        ]);

    Storage::disk('local')->put($import->path, implode("\n", [
        'unidad,edificio,nombres,apellidos,email,tipo_residente',
        '301,Torre A,Ana,Salas,ana@example.test,owner',
        ',Torre B,Luis,Rojas,luis@example.test,tenant',
    ]));

    (new ValidateRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::ReadyForReview)
        ->and($import->total_rows)->toBe(2)
        ->and($import->valid_rows)->toBe(1)
        ->and($import->error_rows)->toBe(1)
        ->and($import->duplicate_rows)->toBe(0)
        ->and($import->warning_rows)->toBe(0)
        ->and($import->failed_at)->toBeNull()
        ->and($import->failure_reason)->toBeNull();

    $rows = RegistryImportRow::query()->where('registry_import_id', $import->id)->orderBy('row_number')->get();

    expect($rows)->toHaveCount(2)
        ->and($rows[0]->status)->toBe(ImportRowStatus::Valid)
        ->and($rows[0]->normalized_data['unit_number'])->toBe('301')
        ->and($rows[0]->normalized_data['resident_type'])->toBe('owner')
        ->and($rows[1]->status)->toBe(ImportRowStatus::Error)
        ->and($rows[1]->errors)->toContain('El campo unidad es obligatorio.');

    expect(Unit::query()->count())->toBe(0)
        ->and(Resident::query()->count())->toBe(0)
        ->and(UnitMembership::query()->count())->toBe(0);
});

test('validation job replaces stale preview rows on retry', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'disk' => 'local',
            'path' => 'imports/test/retry.csv',
        ]);

    RegistryImportRow::factory()
        ->for($import)
        ->for($location->account)
        ->for($location)
        ->create([
            'row_number' => 99,
            'status' => ImportRowStatus::Error,
            'errors' => ['Fila anterior.'],
        ]);

    Storage::disk('local')->put($import->path, "unidad\n401\n");

    (new ValidateRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::ReadyForReview)
        ->and($import->rows()->count())->toBe(1)
        ->and($import->rows()->first()->row_number)->toBe(2);
});

test('validation job counts warning and duplicate preview rows', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    Unit::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'unit_number' => '301',
            'building_name' => 'Torre A',
        ]);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'disk' => 'local',
            'path' => 'imports/test/counts.csv',
        ]);

    Storage::disk('local')->put($import->path, implode("\n", [
        'unidad,edificio',
        '301,Torre A',
        '301,Torre A',
    ]));

    (new ValidateRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::ReadyForReview)
        ->and($import->total_rows)->toBe(2)
        ->and($import->valid_rows)->toBe(0)
        ->and($import->error_rows)->toBe(0)
        ->and($import->warning_rows)->toBe(1)
        ->and($import->duplicate_rows)->toBe(1);
});

test('validation job marks import failed when stored file is missing', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'disk' => 'local',
            'path' => 'imports/missing.csv',
        ]);

    (new ValidateRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Failed)
        ->and($import->failed_at)->not->toBeNull()
        ->and($import->failure_reason)->toBe('No se pudo leer el archivo CSV almacenado.');
});

test('validation job marks import failed when parser rejects csv contents', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'disk' => 'local',
            'path' => 'imports/invalid.csv',
        ]);

    Storage::disk('local')->put($import->path, "edificio\nTorre A\n");

    (new ValidateRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Failed)
        ->and($import->failed_at)->not->toBeNull()
        ->and($import->failure_reason)->toBe('Falta el encabezado requerido: unidad.');
});

test('validation job does not run for an import another worker already claimed', function () {
    Storage::fake('local');

    $location = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'status' => ImportStatus::Processing,
            'disk' => 'local',
            'path' => 'imports/test/claimed.csv',
        ]);

    Storage::disk('local')->put($import->path, implode("\n", [
        'unidad,edificio,nombres,apellidos,email,tipo_residente',
        '301,Torre A,Ana,Salas,ana@example.test,owner',
    ]));

    (new ValidateRegistryImport($import))->handle();

    expect($import->fresh()->status)->toBe(ImportStatus::Processing)
        ->and(RegistryImportRow::query()->where('registry_import_id', $import->id)->count())->toBe(0);
});

test('a storage failure during upload leaves no import record behind', function () {
    $location = Location::factory()->create();
    $manager = createRegistryImportManager($location);

    Storage::shouldReceive('disk')
        ->andThrow(new RuntimeException('disk unavailable'));

    $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/registry-imports", [
            'file' => UploadedFile::fake()->createWithContent('registro.csv', "unidad\n101"),
            'import_type' => ImportType::RegistryUnitsResidents->value,
        ])
        ->assertServerError();

    expect(RegistryImport::query()->count())->toBe(0);
});
