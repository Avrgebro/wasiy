<?php

use App\Enums\AccountRole;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Jobs\CommitRegistryImport;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

function createImportCommitAdmin(Account $account): User
{
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    return $admin;
}

function createImportCommitLocationUser(Location $location, LocationRole $role): User
{
    $user = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $user->id,
        'role' => $role,
    ]);

    return $user;
}

function createReadyRegistryImport(Location $location, array $attributes = []): RegistryImport
{
    return RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'status' => ImportStatus::ReadyForReview,
            'import_type' => ImportType::RegistryUnitsResidents,
            'total_rows' => 0,
            'valid_rows' => 0,
            'error_rows' => 0,
            'duplicate_rows' => 0,
            'warning_rows' => 0,
            ...$attributes,
        ]);
}

function createImportCommitRow(RegistryImport $import, array $normalizedData, array $attributes = []): RegistryImportRow
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

test('confirm rejects imports that are not ready for review', function () {
    Queue::fake();

    $location = Location::factory()->create();
    $admin = createImportCommitAdmin($location->account);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create(['status' => ImportStatus::Pending]);

    $this->actingAs($admin)
        ->postJson("/api/registry-imports/{$import->id}/confirm")
        ->assertUnprocessable();

    Queue::assertNotPushed(CommitRegistryImport::class);
});

test('confirm rejects imports with blocking error rows', function () {
    Queue::fake();

    $location = Location::factory()->create();
    $admin = createImportCommitAdmin($location->account);
    $import = createReadyRegistryImport($location, [
        'total_rows' => 1,
        'error_rows' => 1,
    ]);

    $this->actingAs($admin)
        ->postJson("/api/registry-imports/{$import->id}/confirm")
        ->assertUnprocessable();

    expect($import->fresh()->confirmed_at)->toBeNull();
    Queue::assertNotPushed(CommitRegistryImport::class);
});

test('confirm dispatches commit job for manageable ready import', function () {
    Queue::fake();

    $location = Location::factory()->create();
    $manager = createImportCommitLocationUser($location, LocationRole::LocationManager);
    $import = createReadyRegistryImport($location);

    $this->actingAs($manager)
        ->postJson("/api/registry-imports/{$import->id}/confirm")
        ->assertOk()
        ->assertJsonPath('data.id', $import->id)
        ->assertJsonPath('data.status', ImportStatus::ReadyForReview->value)
        ->assertJsonPath('data.confirmed_at', fn (?string $confirmedAt): bool => $confirmedAt !== null);

    expect($import->fresh()->confirmed_at)->not->toBeNull();
    Queue::assertPushed(CommitRegistryImport::class, fn (CommitRegistryImport $job) => $job->import->id === $import->id);
});

test('commit creates units residents and memberships from committable rows', function () {
    $location = Location::factory()->create();
    $import = createReadyRegistryImport($location, [
        'total_rows' => 2,
        'valid_rows' => 2,
    ]);
    $unitOnlyRow = createImportCommitRow($import, [
        'unit_number' => '301',
        'building_name' => 'Torre A',
        'floor' => '3',
        'unit_notes' => 'Vista interna',
    ], ['row_number' => 2]);
    $residentRow = createImportCommitRow($import, [
        'unit_number' => '302',
        'building_name' => 'Torre A',
        'first_name' => 'Ana',
        'last_name' => 'Salas',
        'phone' => '+51 999 111 222',
        'email' => 'ana@example.test',
        'resident_type' => ResidentType::Owner->value,
        'is_primary_contact' => true,
        'membership_status' => RegistryStatus::Active->value,
    ], ['row_number' => 3]);

    (new CommitRegistryImport($import))->handle();

    $import->refresh();
    $unitOnlyRow->refresh();
    $residentRow->refresh();

    expect($import->status)->toBe(ImportStatus::Completed)
        ->and($import->completed_at)->not->toBeNull()
        ->and($unitOnlyRow->status)->toBe(ImportRowStatus::Imported)
        ->and($residentRow->status)->toBe(ImportRowStatus::Imported);

    $unitOnly = Unit::query()->where('unit_number', '301')->firstOrFail();
    $resident = Resident::query()->where('email', 'ana@example.test')->firstOrFail();
    $membership = UnitMembership::query()->where('resident_id', $resident->id)->firstOrFail();

    expect($unitOnly->location_id)->toBe($location->id)
        ->and($unitOnly->building_name)->toBe('Torre A')
        ->and($unitOnly->notes)->toBe('Vista interna')
        ->and($resident->account_id)->toBe($location->account_id)
        ->and($membership->unit->unit_number)->toBe('302')
        ->and($membership->resident_type)->toBe(ResidentType::Owner)
        ->and($membership->is_primary_contact)->toBeTrue()
        ->and($residentRow->committed_unit_id)->toBe($membership->unit_id)
        ->and($residentRow->committed_resident_id)->toBe($resident->id)
        ->and($residentRow->committed_unit_membership_id)->toBe($membership->id);
});

test('commit reuses existing units and skips duplicate rows', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'unit_number' => '301',
            'building_name' => 'Torre A',
        ]);
    $import = createReadyRegistryImport($location, [
        'total_rows' => 2,
        'warning_rows' => 1,
        'duplicate_rows' => 1,
    ]);
    $warningRow = createImportCommitRow($import, [
        'unit_number' => '301',
        'building_name' => 'Torre A',
        'existing_unit_id' => $unit->id,
    ], ['row_number' => 2, 'status' => ImportRowStatus::Warning]);
    $duplicateRow = createImportCommitRow($import, [
        'unit_number' => '301',
        'building_name' => 'Torre A',
    ], [
        'row_number' => 3,
        'status' => ImportRowStatus::Duplicate,
        'duplicate_key' => 'unit-row:torre a:301',
    ]);

    (new CommitRegistryImport($import))->handle();

    expect(Unit::query()->where('location_id', $location->id)->where('unit_number', '301')->count())->toBe(1)
        ->and($warningRow->fresh()->status)->toBe(ImportRowStatus::Imported)
        ->and($warningRow->fresh()->committed_unit_id)->toBe($unit->id)
        ->and($duplicateRow->fresh()->status)->toBe(ImportRowStatus::Skipped)
        ->and($duplicateRow->fresh()->committed_unit_id)->toBeNull()
        ->and($import->fresh()->status)->toBe(ImportStatus::Completed);
});

test('commit ignores mismatched existing unit ids and stays in import location', function () {
    $account = Account::factory()->create();
    $targetLocation = Location::factory()->for($account)->create();
    $otherLocation = Location::factory()->for($account)->create();
    $otherUnit = Unit::factory()
        ->for($account)
        ->for($otherLocation)
        ->create([
            'unit_number' => '901',
            'building_name' => 'Torre Externa',
        ]);
    $import = createReadyRegistryImport($targetLocation, [
        'total_rows' => 1,
        'warning_rows' => 1,
    ]);
    $row = createImportCommitRow($import, [
        'unit_number' => '901',
        'building_name' => 'Torre Externa',
        'existing_unit_id' => $otherUnit->id,
    ], ['status' => ImportRowStatus::Warning]);

    (new CommitRegistryImport($import))->handle();

    $row->refresh();
    $committedUnit = Unit::query()->findOrFail($row->committed_unit_id);

    expect($committedUnit->location_id)->toBe($targetLocation->id)
        ->and($committedUnit->id)->not->toBe($otherUnit->id)
        ->and($otherUnit->fresh()->location_id)->toBe($otherLocation->id);
});

test('primary contact changes use membership invariant', function () {
    $location = Location::factory()->create();
    $unit = Unit::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'unit_number' => '301',
            'building_name' => null,
        ]);
    $currentResident = Resident::factory()
        ->for($location->account)
        ->create();
    $currentPrimary = UnitMembership::factory()
        ->for($location->account)
        ->for($location)
        ->for($unit)
        ->for($currentResident)
        ->primaryContact()
        ->create();
    $import = createReadyRegistryImport($location, [
        'total_rows' => 1,
        'warning_rows' => 1,
    ]);
    $row = createImportCommitRow($import, [
        'unit_number' => '301',
        'existing_unit_id' => $unit->id,
        'first_name' => 'Luis',
        'last_name' => 'Rojas',
        'email' => 'luis@example.test',
        'resident_type' => ResidentType::Tenant->value,
        'is_primary_contact' => true,
        'membership_status' => RegistryStatus::Active->value,
    ], ['status' => ImportRowStatus::Warning]);

    (new CommitRegistryImport($import))->handle();

    $newMembership = UnitMembership::query()->findOrFail($row->fresh()->committed_unit_membership_id);

    expect($currentPrimary->fresh()->is_primary_contact)->toBeFalse()
        ->and($newMembership->is_primary_contact)->toBeTrue()
        ->and($newMembership->status)->toBe(RegistryStatus::Active);
});

test('failed commit is visible on the import record', function () {
    $location = Location::factory()->create();
    $import = createReadyRegistryImport($location, [
        'total_rows' => 1,
        'valid_rows' => 1,
    ]);
    createImportCommitRow($import, [
        'unit_number' => null,
    ]);

    (new CommitRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Failed)
        ->and($import->failed_at)->not->toBeNull()
        ->and($import->failure_reason)->not->toBeNull();
});

test('commit job does not run for an import another worker already claimed', function () {
    $location = Location::factory()->create();
    $import = createReadyRegistryImport($location, [
        'status' => ImportStatus::Processing,
        'total_rows' => 1,
        'valid_rows' => 1,
    ]);
    createImportCommitRow($import, ['unit_number' => '101']);

    (new CommitRegistryImport($import))->handle();

    expect($import->fresh()->status)->toBe(ImportStatus::Processing)
        ->and(Unit::query()->count())->toBe(0)
        ->and($import->rows()->where('status', ImportRowStatus::Imported)->count())->toBe(0);
});

test('a failing row rolls back every committed row in the same import', function () {
    $location = Location::factory()->create();
    $import = createReadyRegistryImport($location, [
        'total_rows' => 2,
        'valid_rows' => 2,
    ]);
    createImportCommitRow($import, ['unit_number' => '101'], ['row_number' => 2]);
    // A null unit number blows up inside the commit; the first row must not
    // survive the failure.
    createImportCommitRow($import, ['unit_number' => null], ['row_number' => 3]);

    (new CommitRegistryImport($import))->handle();

    $import->refresh();

    expect($import->status)->toBe(ImportStatus::Failed)
        ->and($import->failed_at)->not->toBeNull()
        ->and($import->failure_reason)->not->toBeNull()
        ->and(Unit::query()->count())->toBe(0)
        ->and($import->rows()->where('status', ImportRowStatus::Imported)->count())->toBe(0)
        ->and($import->rows()->whereNotNull('committed_unit_id')->count())->toBe(0);
});
