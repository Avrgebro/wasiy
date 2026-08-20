<?php

use App\Enums\AccountRole;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Enums\LocationRole;
use App\Http\Resources\RegistryImportResource;
use App\Http\Resources\RegistryImportRowResource;
use App\Models\Account;
use App\Models\Location;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('registry import model casts statuses counters and timestamps', function () {
    $location = Location::factory()->create();
    $manager = User::factory()->create();

    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->for($manager, 'requestedBy')
        ->create([
            'import_type' => ImportType::RegistryUnitsResidents,
            'status' => ImportStatus::ReadyForReview,
            'total_rows' => 5,
            'valid_rows' => 2,
            'error_rows' => 1,
            'duplicate_rows' => 1,
            'warning_rows' => 1,
            'confirmed_at' => now(),
            'completed_at' => now(),
            'failed_at' => now(),
        ]);

    $import->refresh();

    expect($import->import_type)->toBe(ImportType::RegistryUnitsResidents)
        ->and($import->status)->toBe(ImportStatus::ReadyForReview)
        ->and($import->total_rows)->toBe(5)
        ->and($import->valid_rows)->toBe(2)
        ->and($import->error_rows)->toBe(1)
        ->and($import->duplicate_rows)->toBe(1)
        ->and($import->warning_rows)->toBe(1)
        ->and($import->confirmed_at)->not->toBeNull()
        ->and($import->completed_at)->not->toBeNull()
        ->and($import->failed_at)->not->toBeNull()
        ->and($import->account->is($location->account))->toBeTrue()
        ->and($import->location->is($location))->toBeTrue()
        ->and($import->requestedBy->is($manager))->toBeTrue();
});

test('registry import counters default to zero', function () {
    $location = Location::factory()->create();

    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create();

    expect($import->total_rows)->toBe(0)
        ->and($import->valid_rows)->toBe(0)
        ->and($import->error_rows)->toBe(0)
        ->and($import->duplicate_rows)->toBe(0)
        ->and($import->warning_rows)->toBe(0)
        ->and($import->status)->toBe(ImportStatus::Pending);
});

test('registry import row casts json fields and belongs to import scope', function () {
    $location = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create();

    $row = RegistryImportRow::factory()
        ->for($import)
        ->for($location->account)
        ->for($location)
        ->create([
            'row_number' => 7,
            'status' => ImportRowStatus::Warning,
            'raw_data' => [
                'unidad' => '301',
                'email' => 'ana@example.test',
            ],
            'normalized_data' => [
                'unit_number' => '301',
                'email' => 'ana@example.test',
            ],
            'errors' => [],
            'warnings' => ['La unidad existente sera reutilizada.'],
            'duplicate_key' => 'unit:location-1:301:',
        ]);

    $row->refresh();

    expect($row->registryImport->is($import))->toBeTrue()
        ->and($row->account->is($location->account))->toBeTrue()
        ->and($row->location->is($location))->toBeTrue()
        ->and($row->row_number)->toBe(7)
        ->and($row->status)->toBe(ImportRowStatus::Warning)
        ->and($row->raw_data)->toBe(['unidad' => '301', 'email' => 'ana@example.test'])
        ->and($row->normalized_data)->toBe(['unit_number' => '301', 'email' => 'ana@example.test'])
        ->and($row->errors)->toBe([])
        ->and($row->warnings)->toBe(['La unidad existente sera reutilizada.'])
        ->and($row->duplicate_key)->toBe('unit:location-1:301:');
});

test('registry import row scope cannot drift from parent import', function () {
    $location = Location::factory()->create();
    $otherLocation = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create();

    expect(fn () => RegistryImportRow::factory()
        ->for($import)
        ->for($otherLocation->account)
        ->for($otherLocation)
        ->create())->toThrow(QueryException::class);
});

test('registry import policy allows admins and managers for manageable locations', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $otherLocation = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    $manager = User::factory()->create();

    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $import = RegistryImport::factory()
        ->for($account)
        ->for($location)
        ->create();

    $otherImport = RegistryImport::factory()
        ->for($account)
        ->for($otherLocation)
        ->create();

    expect($admin->can('viewAny', [RegistryImport::class, $account, null]))->toBeTrue()
        ->and($admin->can('create', [RegistryImport::class, $location]))->toBeTrue()
        ->and($admin->can('view', $import))->toBeTrue()
        ->and($admin->can('confirm', $import))->toBeTrue()
        ->and($admin->can('retry', $import))->toBeTrue()
        ->and($manager->can('viewAny', [RegistryImport::class, $account, $location]))->toBeTrue()
        ->and($manager->can('create', [RegistryImport::class, $location]))->toBeTrue()
        ->and($manager->can('view', $import))->toBeTrue()
        ->and($manager->can('confirm', $import))->toBeTrue()
        ->and($manager->can('retry', $import))->toBeTrue()
        ->and($manager->can('view', $otherImport))->toBeFalse()
        ->and($manager->can('create', [RegistryImport::class, $otherLocation]))->toBeFalse();
});

test('registry import policy denies front desk residents and inaccessible locations', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $frontDesk = User::factory()->create();
    $outsider = User::factory()->create();

    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    $import = RegistryImport::factory()
        ->for($account)
        ->for($location)
        ->create();

    expect($frontDesk->can('viewAny', [RegistryImport::class, $account, $location]))->toBeFalse()
        ->and($frontDesk->can('create', [RegistryImport::class, $location]))->toBeFalse()
        ->and($frontDesk->can('view', $import))->toBeFalse()
        ->and($frontDesk->can('confirm', $import))->toBeFalse()
        ->and($frontDesk->can('retry', $import))->toBeFalse()
        ->and($outsider->can('viewAny', [RegistryImport::class, $account, $location]))->toBeFalse()
        ->and($outsider->can('create', [RegistryImport::class, $location]))->toBeFalse()
        ->and($outsider->can('view', $import))->toBeFalse();
});

test('registry import resources expose tracking data without storage paths', function () {
    $location = Location::factory()->create();
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'status' => ImportStatus::Failed,
            'disk' => 'local',
            'path' => 'imports/hidden.csv',
            'failure_reason' => 'No se pudo leer el archivo.',
        ]);
    $row = RegistryImportRow::factory()
        ->for($import)
        ->for($location->account)
        ->for($location)
        ->create([
            'status' => ImportRowStatus::Error,
            'errors' => ['La unidad es obligatoria.'],
        ]);

    $importPayload = (new RegistryImportResource($import))->resolve();
    $rowPayload = (new RegistryImportRowResource($row))->resolve();

    expect($importPayload)->toHaveKeys([
        'id',
        'account_id',
        'location_id',
        'requested_by_user_id',
        'import_type',
        'status',
        'original_filename',
        'total_rows',
        'valid_rows',
        'error_rows',
        'duplicate_rows',
        'warning_rows',
        'failure_reason',
        'created_at',
        'updated_at',
    ])
        ->and($importPayload)->not->toHaveKeys(['disk', 'path'])
        ->and($importPayload['status'])->toBe(ImportStatus::Failed->value)
        ->and($rowPayload)->toHaveKeys([
            'id',
            'registry_import_id',
            'account_id',
            'location_id',
            'row_number',
            'status',
            'raw_data',
            'normalized_data',
            'errors',
            'warnings',
            'duplicate_key',
            'committed_unit_id',
            'committed_resident_id',
            'committed_unit_membership_id',
            'created_at',
            'updated_at',
        ])
        ->and($rowPayload['status'])->toBe(ImportRowStatus::Error->value)
        ->and($rowPayload['errors'])->toBe(['La unidad es obligatoria.']);
});
