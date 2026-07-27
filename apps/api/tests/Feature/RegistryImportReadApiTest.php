<?php

use App\Enums\AccountRole;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createImportReadAdmin(Account $account): User
{
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    return $admin;
}

function createImportReadLocationUser(Location $location, LocationRole $role): User
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

test('account admin can list account imports and filter by location and status', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $admin = createImportReadAdmin($account);

    $readyImport = RegistryImport::factory()
        ->for($account)
        ->for($firstLocation)
        ->create([
            'status' => ImportStatus::ReadyForReview,
            'import_type' => ImportType::RegistryUnitsResidents,
            'original_filename' => 'ready.csv',
        ]);
    RegistryImport::factory()
        ->for($account)
        ->for($secondLocation)
        ->create([
            'status' => ImportStatus::Failed,
            'original_filename' => 'failed.csv',
        ]);
    RegistryImport::factory()->create();

    $this->actingAs($admin)
        ->getJson("/api/registry-imports?account_id={$account->id}&location_id={$firstLocation->id}&status=ready_for_review&import_type=registry_units_residents")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $readyImport->id)
        ->assertJsonPath('data.0.original_filename', 'ready.csv')
        ->assertJsonMissingPath('data.0.path')
        ->assertJsonMissingPath('data.0.disk');
});

test('location manager list is constrained to manageable locations', function () {
    $account = Account::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $manager = createImportReadLocationUser($accessibleLocation, LocationRole::LocationManager);

    $visibleImport = RegistryImport::factory()
        ->for($account)
        ->for($accessibleLocation)
        ->create(['original_filename' => 'visible.csv']);
    RegistryImport::factory()
        ->for($account)
        ->for($inaccessibleLocation)
        ->create(['original_filename' => 'hidden.csv']);

    $this->actingAs($manager)
        ->getJson("/api/registry-imports?account_id={$account->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $visibleImport->id);

    $this->actingAs($manager)
        ->getJson("/api/registry-imports?account_id={$account->id}&location_id={$inaccessibleLocation->id}")
        ->assertForbidden();
});

test('front desk cannot list registry imports', function () {
    $location = Location::factory()->create();
    $frontDesk = createImportReadLocationUser($location, LocationRole::FrontDesk);

    $this->actingAs($frontDesk)
        ->getJson("/api/registry-imports?account_id={$location->account_id}&location_id={$location->id}")
        ->assertForbidden();
});

test('import detail is denied for inaccessible location', function () {
    $account = Account::factory()->create();
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $manager = createImportReadLocationUser($accessibleLocation, LocationRole::LocationManager);
    $import = RegistryImport::factory()
        ->for($account)
        ->for($inaccessibleLocation)
        ->create();

    $this->actingAs($manager)
        ->getJson("/api/registry-imports/{$import->id}")
        ->assertForbidden();
});

test('import detail exposes tracking data without storage path', function () {
    $location = Location::factory()->create();
    $admin = createImportReadAdmin($location->account);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create([
            'status' => ImportStatus::Failed,
            'disk' => 'local',
            'path' => 'imports/secret.csv',
            'failure_reason' => 'No se pudo leer el archivo CSV almacenado.',
        ]);

    $this->actingAs($admin)
        ->getJson("/api/registry-imports/{$import->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $import->id)
        ->assertJsonPath('data.failure_reason', 'No se pudo leer el archivo CSV almacenado.')
        ->assertJsonMissingPath('data.path')
        ->assertJsonMissingPath('data.disk');
});

test('row list supports status filtering pagination and search', function () {
    $location = Location::factory()->create();
    $admin = createImportReadAdmin($location->account);
    $import = RegistryImport::factory()
        ->for($location->account)
        ->for($location)
        ->create();
    RegistryImportRow::factory()
        ->for($import)
        ->for($location->account)
        ->for($location)
        ->create([
            'row_number' => 2,
            'status' => ImportRowStatus::Error,
            'raw_data' => ['unidad' => null, 'email' => 'ana@example.test'],
            'normalized_data' => ['unit_number' => null, 'email' => 'ana@example.test'],
            'errors' => ['El campo unidad es obligatorio.'],
            'warnings' => [],
        ]);
    RegistryImportRow::factory()
        ->for($import)
        ->for($location->account)
        ->for($location)
        ->create([
            'row_number' => 3,
            'status' => ImportRowStatus::Warning,
            'raw_data' => ['unidad' => '301', 'email' => 'luis@example.test'],
            'normalized_data' => ['unit_number' => '301', 'email' => 'luis@example.test'],
            'errors' => [],
            'warnings' => ['La unidad existente sera reutilizada.'],
        ]);

    $this->actingAs($admin)
        ->getJson("/api/registry-imports/{$import->id}/rows?status=error&search=ana&page=1&per_page=1")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.row_number', 2)
        ->assertJsonPath('data.0.status', ImportRowStatus::Error->value)
        ->assertJsonPath('data.0.errors.0', 'El campo unidad es obligatorio.')
        ->assertJsonPath('meta.total', 1);
});
