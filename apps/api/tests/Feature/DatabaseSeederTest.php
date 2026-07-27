<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\ExportType;
use App\Enums\ImportRowStatus;
use App\Enums\ImportStatus;
use App\Enums\ImportType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Enums\VehicleType;
use App\Jobs\CommitRegistryImport;
use App\Jobs\ValidateRegistryImport;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\UserInvitation;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

test('it seeds the m1 demo account location and location manager assignment', function () {
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $assignment = LocationUserRole::query()
        ->whereBelongsTo($account)
        ->whereBelongsTo($location)
        ->whereBelongsTo($manager)
        ->sole();

    expect($location->account->is($account))->toBeTrue()
        ->and($manager->assignedLocations)->toHaveCount(1)
        ->and($manager->assignedLocations->first()->is($location))->toBeTrue()
        ->and($assignment->role)->toBe(LocationRole::LocationManager);
});

test('it seeds m2 demo users and role assignments idempotently', function () {
    $this->seed();
    $this->seed();

    $demoAccount = Account::query()->where('slug', 'wasiy-demo')->sole();
    $playaAccount = Account::query()->where('slug', 'wasiy-playa')->sole();
    $centralLocation = Location::query()->where('slug', 'edificio-central')->sole();
    $northTower = Location::query()->where('slug', 'torre-norte')->sole();
    $beachLocation = Location::query()->where('slug', 'edificio-playa')->sole();

    $admin = User::query()->where('email', 'admin@wasiy.test')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $frontDesk = User::query()->where('email', 'frontdesk@wasiy.test')->sole();
    $multiAccountUser = User::query()->where('email', 'multi@wasiy.test')->sole();

    expect(Account::query()->whereIn('slug', ['wasiy-demo', 'wasiy-playa'])->count())->toBe(2)
        ->and(Location::query()->whereIn('slug', ['edificio-central', 'torre-norte', 'edificio-playa'])->count())->toBe(3)
        ->and(User::query()->whereIn('email', [
            'admin@wasiy.test',
            'manager@wasiy.test',
            'frontdesk@wasiy.test',
            'multi@wasiy.test',
            'resident@wasiy.test',
        ])->count())->toBe(5)
        ->and(AccountUserRole::query()->where('account_id', $demoAccount->id)->where('user_id', $admin->id)->sole()->role)
        ->toBe(AccountRole::AccountAdmin)
        ->and(LocationUserRole::query()->where('account_id', $demoAccount->id)->where('location_id', $centralLocation->id)->where('user_id', $manager->id)->sole()->role)
        ->toBe(LocationRole::LocationManager)
        ->and(LocationUserRole::query()->where('account_id', $demoAccount->id)->where('location_id', $northTower->id)->where('user_id', $frontDesk->id)->sole()->role)
        ->toBe(LocationRole::FrontDesk)
        ->and(LocationUserRole::query()->where('account_id', $demoAccount->id)->where('location_id', $centralLocation->id)->where('user_id', $multiAccountUser->id)->sole()->role)
        ->toBe(LocationRole::LocationManager)
        ->and(LocationUserRole::query()->where('account_id', $playaAccount->id)->where('location_id', $beachLocation->id)->where('user_id', $multiAccountUser->id)->sole()->role)
        ->toBe(LocationRole::FrontDesk)
        ->and(AccountUserRole::query()->count())->toBe(1)
        ->and(LocationUserRole::query()->count())->toBe(4);
});

test('seeded users expose the final m2 access context scenarios', function () {
    $this->seed();

    $demoAccount = Account::query()->where('slug', 'wasiy-demo')->sole();
    $playaAccount = Account::query()->where('slug', 'wasiy-playa')->sole();
    $centralLocation = Location::query()->where('slug', 'edificio-central')->sole();
    $northTower = Location::query()->where('slug', 'torre-norte')->sole();
    $beachLocation = Location::query()->where('slug', 'edificio-playa')->sole();

    $admin = User::query()->where('email', 'admin@wasiy.test')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $frontDesk = User::query()->where('email', 'frontdesk@wasiy.test')->sole();
    $multiAccountUser = User::query()->where('email', 'multi@wasiy.test')->sole();

    $this->actingAs($admin)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $demoAccount->id)
        ->assertJsonPath('active_location', null)
        ->assertJsonPath('roles.account.0.role', AccountRole::AccountAdmin->value)
        ->assertJsonCount(2, 'accessible_locations');

    $this->flushSession();

    $this->actingAs($manager)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $demoAccount->id)
        ->assertJsonPath('active_location.id', $centralLocation->id)
        ->assertJsonPath('roles.location.0.role', LocationRole::LocationManager->value)
        ->assertJsonCount(1, 'accessible_locations');

    $this->flushSession();

    $this->actingAs($frontDesk)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $demoAccount->id)
        ->assertJsonPath('active_location.id', $northTower->id)
        ->assertJsonPath('roles.location.0.role', LocationRole::FrontDesk->value)
        ->assertJsonCount(1, 'accessible_locations');

    $this->flushSession();

    $this->actingAs($multiAccountUser)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonCount(2, 'accounts')
        ->assertJsonPath('active_account', null)
        ->assertJsonPath('active_location', null)
        ->assertJsonCount(0, 'roles.account')
        ->assertJsonCount(0, 'roles.location')
        ->assertJsonCount(0, 'accessible_locations');

    $this->actingAs($multiAccountUser)
        ->postJson('/api/context/account', [
            'account_id' => $playaAccount->id,
        ])
        ->assertOk()
        ->assertJsonPath('active_account.id', $playaAccount->id)
        ->assertJsonPath('active_location.id', $beachLocation->id)
        ->assertJsonPath('roles.location.0.role', LocationRole::FrontDesk->value);
});

test('seeded account admin can complete staff workflow and activity logging acceptance', function () {
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();
    $admin = User::query()->where('email', 'admin@wasiy.test')->sole();

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'slice7.staff@wasiy.test',
            'first_name' => 'Slice',
            'last_name' => 'Seven',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertCreated();

    $staff = User::query()->where('email', 'slice7.staff@wasiy.test')->sole();
    $invitation = UserInvitation::query()->where('email', 'slice7.staff@wasiy.test')->sole();

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/roles", [
            'account_role' => AccountRole::AccountAdmin->value,
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(2)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::StaffInvited->value)->sole()->metadata)
        ->toMatchArray([
            'invitation_id' => $invitation->id,
            'staff_user_id' => $staff->id,
            'account_id' => $account->id,
        ])
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::StaffRoleAssigned->value)->sole()->metadata)
        ->toMatchArray([
            'account_role_before' => null,
            'account_role_after' => AccountRole::AccountAdmin->value,
            'staff_user_id' => $staff->id,
            'account_id' => $account->id,
        ]);
});

test('it seeds m3 registry scenarios idempotently', function () {
    $this->seed();
    $this->seed();

    $demoAccount = Account::query()->where('slug', 'wasiy-demo')->sole();
    $centralLocation = Location::query()->where('slug', 'edificio-central')->sole();
    $northTower = Location::query()->where('slug', 'torre-norte')->sole();
    $residentUser = User::query()->where('email', 'resident@wasiy.test')->sole();

    $centralUnits = Unit::query()
        ->where('location_id', $centralLocation->id)
        ->whereIn('unit_number', ['101', '102', '201', '301'])
        ->get();
    $northUnits = Unit::query()
        ->where('location_id', $northTower->id)
        ->whereIn('unit_number', ['501', '502'])
        ->get();

    $claimedResident = Resident::query()
        ->where('email', 'resident@wasiy.test')
        ->where('user_id', $residentUser->id)
        ->sole();
    $multiUnitResident = Resident::query()->where('email', 'multi.resident@wasiy.test')->sole();
    $invitedResident = Resident::query()->where('email', 'invited.resident@wasiy.test')->sole();

    expect($centralUnits)->toHaveCount(4)
        ->and($northUnits)->toHaveCount(2)
        ->and(Unit::query()->where('account_id', $demoAccount->id)->where('status', RegistryStatus::Inactive)->count())->toBeGreaterThanOrEqual(1)
        ->and(UnitMembership::query()->where('resident_id', $claimedResident->id)->where('status', RegistryStatus::Active)->count())->toBeGreaterThanOrEqual(1)
        ->and(UnitMembership::query()->where('resident_id', $multiUnitResident->id)->where('status', RegistryStatus::Active)->count())->toBe(2)
        ->and(UnitMembership::query()->where('unit_id', Unit::query()->where('unit_number', '101')->where('location_id', $centralLocation->id)->sole()->id)->where('is_primary_contact', true)->count())->toBe(1)
        ->and(UserInvitation::query()->where('resident_id', $invitedResident->id)->where('purpose', UserInvitationPurpose::Resident)->where('status', UserInvitationStatus::Pending)->count())->toBe(1)
        ->and(Vehicle::query()->where('account_id', $demoAccount->id)->count())->toBeGreaterThanOrEqual(3);
});

test('seeded resident has portal access and can manage own phone and vehicles only', function () {
    $this->seed();

    $residentUser = User::query()->where('email', 'resident@wasiy.test')->sole();
    $resident = Resident::query()->where('user_id', $residentUser->id)->sole();
    $membership = UnitMembership::query()
        ->where('resident_id', $resident->id)
        ->where('status', RegistryStatus::Active)
        ->with('unit')
        ->firstOrFail();

    $this->actingAs($residentUser)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('resident_memberships.0.resident_id', $resident->id)
        ->assertJsonPath('resident_memberships.0.unit_id', $membership->unit_id);

    $this->actingAs($residentUser)
        ->patchJson('/api/portal/resident/phone', [
            'phone' => '999-777-555',
        ])
        ->assertOk()
        ->assertJsonPath('data.phone', '999-777-555');

    $this->actingAs($residentUser)
        ->patchJson('/api/portal/resident/phone', [
            'first_name' => 'Nope',
            'phone' => '999-777-555',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('first_name');

    $this->actingAs($residentUser)
        ->postJson('/api/portal/vehicles', [
            'unit_id' => $membership->unit_id,
            'vehicle_type' => VehicleType::Bicycle->value,
            'plate' => 'BIKE-SEED',
        ])
        ->assertCreated()
        ->assertJsonPath('data.unit_id', $membership->unit_id);

    $otherUnit = Unit::query()
        ->where('account_id', $membership->account_id)
        ->whereKeyNot($membership->unit_id)
        ->firstOrFail();

    $this->actingAs($residentUser)
        ->postJson('/api/portal/vehicles', [
            'unit_id' => $otherUnit->id,
            'vehicle_type' => VehicleType::Car->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('unit_id');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::ResidentPhoneUpdated)->count())->toBe(1)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::VehicleCreated)->count())->toBe(1);
});

test('seeded manager can complete m3 registry export and activity acceptance flow', function () {
    Queue::fake();
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $unit = Unit::query()->where('location_id', $location->id)->where('unit_number', '101')->sole();

    $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/units", [
            'unit_number' => '901',
            'building_name' => 'Torre C',
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', RegistryStatus::Active->value);

    $residentResponse = $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/residents", [
            'first_name' => 'Aceptacion',
            'last_name' => 'M3',
            'email' => 'acceptance.resident@wasiy.test',
            'memberships' => [[
                'unit_id' => $unit->id,
                'resident_type' => ResidentType::GuestResident->value,
            ]],
        ])
        ->assertCreated();

    $residentId = $residentResponse->json('data.id');

    $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/vehicles", [
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car->value,
            'plate' => 'M3-OK',
        ])
        ->assertCreated();

    $this->actingAs($manager)
        ->postJson('/api/exports', [
            'account_id' => $account->id,
            'location_id' => $location->id,
            'export_type' => ExportType::RegistryUnitsResidents->value,
            'filters' => [
                'status' => RegistryStatus::Active->value,
            ],
        ])
        ->assertCreated();

    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::UnitCreated->value,
        'actor_user_id' => $manager->id,
    ]);
    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::ResidentCreated->value,
        'actor_user_id' => $manager->id,
        'subject_type' => Resident::class,
        'subject_id' => $residentId,
    ]);
    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::VehicleCreated->value,
        'actor_user_id' => $manager->id,
    ]);
    $this->assertDatabaseHas('activity_logs', [
        'event_type' => ActivityEventType::ExportRequested->value,
        'actor_user_id' => $manager->id,
    ]);
});

test('seeded manager can complete m4 registry import acceptance flow', function () {
    Queue::fake();
    Storage::fake('local');
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();
    $northTower = Location::query()->where('slug', 'torre-norte')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $existingUnit = Unit::query()
        ->where('location_id', $location->id)
        ->where('building_name', 'Torre A')
        ->where('unit_number', '101')
        ->sole();
    $existingResident = Resident::query()
        ->where('account_id', $account->id)
        ->where('email', 'resident@wasiy.test')
        ->sole();
    $fixture = m4RegistryImportAcceptanceFixture();
    $unitCountBeforeValidation = Unit::query()->where('location_id', $location->id)->count();
    $residentCountBeforeValidation = Resident::query()->where('account_id', $account->id)->count();
    $membershipCountBeforeValidation = UnitMembership::query()->where('location_id', $location->id)->count();

    $this->actingAs($manager)
        ->postJson("/api/locations/{$northTower->id}/registry-imports", [
            'import_type' => ImportType::RegistryUnitsResidents->value,
            'file' => UploadedFile::fake()->createWithContent('m4-registry-import-acceptance.csv', $fixture),
        ])
        ->assertForbidden();

    $uploadResponse = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/registry-imports", [
            'import_type' => ImportType::RegistryUnitsResidents->value,
            'file' => UploadedFile::fake()->createWithContent('m4-registry-import-acceptance.csv', $fixture),
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', ImportStatus::Pending->value);

    $previewImport = RegistryImport::query()->findOrFail($uploadResponse->json('data.id'));
    Queue::assertPushed(ValidateRegistryImport::class, fn (ValidateRegistryImport $job): bool => $job->import->id === $previewImport->id);

    (new ValidateRegistryImport($previewImport))->handle();
    $previewImport->refresh();

    expect($previewImport->status)->toBe(ImportStatus::ReadyForReview)
        ->and($previewImport->total_rows)->toBe(6)
        ->and($previewImport->valid_rows)->toBe(3)
        ->and($previewImport->error_rows)->toBe(1)
        ->and($previewImport->duplicate_rows)->toBe(1)
        ->and($previewImport->warning_rows)->toBe(1)
        ->and(Unit::query()->where('location_id', $location->id)->count())->toBe($unitCountBeforeValidation)
        ->and(Resident::query()->where('account_id', $account->id)->count())->toBe($residentCountBeforeValidation)
        ->and(UnitMembership::query()->where('location_id', $location->id)->count())->toBe($membershipCountBeforeValidation);

    $this->actingAs($manager)
        ->getJson("/api/registry-imports/{$previewImport->id}/rows?status=".ImportRowStatus::Error->value)
        ->assertOk()
        ->assertJsonPath('data.0.errors.0', 'El campo unidad es obligatorio.');

    $this->actingAs($manager)
        ->getJson("/api/registry-imports/{$previewImport->id}/rows?status=".ImportRowStatus::Duplicate->value)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.duplicate_key', "membership:{$existingUnit->id}:{$existingResident->id}");

    $this->actingAs($manager)
        ->getJson("/api/registry-imports/{$previewImport->id}/rows?status=".ImportRowStatus::Warning->value)
        ->assertOk()
        ->assertJsonPath('data.0.warnings.0', 'La unidad existente sera reutilizada.');

    $this->actingAs($manager)
        ->postJson("/api/registry-imports/{$previewImport->id}/confirm")
        ->assertUnprocessable();

    $confirmableResponse = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/registry-imports", [
            'import_type' => ImportType::RegistryUnitsResidents->value,
            'file' => UploadedFile::fake()->createWithContent(
                'm4-registry-import-confirmable.csv',
                m4RegistryImportConfirmableFixture($fixture),
            ),
        ])
        ->assertCreated();

    $confirmableImport = RegistryImport::query()->findOrFail($confirmableResponse->json('data.id'));
    (new ValidateRegistryImport($confirmableImport))->handle();
    $confirmableImport->refresh();

    expect($confirmableImport->error_rows)->toBe(0)
        ->and($confirmableImport->valid_rows)->toBe(3)
        ->and($confirmableImport->duplicate_rows)->toBe(1)
        ->and($confirmableImport->warning_rows)->toBe(1);

    $this->actingAs($manager)
        ->postJson("/api/registry-imports/{$confirmableImport->id}/confirm")
        ->assertOk()
        ->assertJsonPath('data.confirmed_at', fn (?string $confirmedAt): bool => $confirmedAt !== null);

    Queue::assertPushed(CommitRegistryImport::class, fn (CommitRegistryImport $job): bool => $job->import->id === $confirmableImport->id);

    (new CommitRegistryImport($confirmableImport))->handle();
    $confirmableImport->refresh();

    $newResident = Resident::query()->where('email', 'julia.import@wasiy.test')->sole();
    $primaryResident = Resident::query()->where('email', 'pedro.primary@wasiy.test')->sole();
    $primaryMembership = UnitMembership::query()
        ->where('resident_id', $primaryResident->id)
        ->where('is_primary_contact', true)
        ->sole();

    expect($confirmableImport->status)->toBe(ImportStatus::Completed)
        ->and(Unit::query()->where('location_id', $location->id)->where('building_name', 'Torre Import')->where('unit_number', '701')->count())->toBe(1)
        ->and(Unit::query()->where('location_id', $location->id)->where('building_name', 'Torre A')->where('unit_number', '101')->count())->toBe(1)
        ->and(UnitMembership::query()->where('resident_id', $newResident->id)->where('location_id', $location->id)->count())->toBe(1)
        ->and($primaryMembership->unit->unit_number)->toBe('703')
        ->and(RegistryImportRow::query()->where('registry_import_id', $confirmableImport->id)->where('status', ImportRowStatus::Skipped)->count())->toBe(1)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::ImportCompleted)->where('subject_id', $confirmableImport->id)->count())->toBe(1);

    $failedResponse = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/registry-imports", [
            'import_type' => ImportType::RegistryUnitsResidents->value,
            'file' => UploadedFile::fake()->createWithContent('m4-registry-import-failed.csv', "edificio\nTorre A\n"),
        ])
        ->assertCreated();

    $failedImport = RegistryImport::query()->findOrFail($failedResponse->json('data.id'));
    (new ValidateRegistryImport($failedImport))->handle();

    $this->actingAs($manager)
        ->getJson("/api/registry-imports/{$failedImport->id}")
        ->assertOk()
        ->assertJsonPath('data.status', ImportStatus::Failed->value)
        ->assertJsonPath('data.failure_reason', 'Falta el encabezado requerido: unidad.');
});

function m4RegistryImportAcceptanceFixture(): string
{
    $path = database_path('seeders/fixtures/m4-registry-import-acceptance.csv');

    expect(is_file($path))->toBeTrue("Missing M4 acceptance fixture at {$path}");

    return file_get_contents($path);
}

function m4RegistryImportConfirmableFixture(string $fixture): string
{
    return collect(explode("\n", trim($fixture)))
        ->reject(fn (string $line): bool => str_starts_with($line, ',Torre Error,'))
        ->implode("\n")."\n";
}
