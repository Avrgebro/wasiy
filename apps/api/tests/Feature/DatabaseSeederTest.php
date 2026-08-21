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
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\RegistryImport;
use App\Models\RegistryImportRow;
use App\Models\Resident;
use App\Models\StaffLocationRole;
use App\Models\StaffMembership;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\UserInvitation;
use App\Models\Vehicle;
use App\Notifications\StaffInvitationNotification;
use App\Services\UserInvitationTokenResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

test('it seeds the m1 demo account location and location manager assignment', function () {
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();
    $location = Location::query()->where('slug', 'edificio-central')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $membership = StaffMembership::query()
        ->whereBelongsTo($account)
        ->whereBelongsTo($manager)
        ->sole();
    $assignment = $membership->locationRoles()->sole();

    expect($location->account->is($account))->toBeTrue()
        ->and($assignment->location_id)->toBe($location->id)
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
        ->and(StaffMembership::query()->where('account_id', $demoAccount->id)->where('user_id', $admin->id)->sole()->account_role)
        ->toBe(AccountRole::AccountAdmin)
        ->and(seededLocationRole($demoAccount, $centralLocation, $manager))
        ->toBe(LocationRole::LocationManager)
        ->and(seededLocationRole($demoAccount, $northTower, $frontDesk))
        ->toBe(LocationRole::FrontDesk)
        ->and(seededLocationRole($demoAccount, $centralLocation, $multiAccountUser))
        ->toBe(LocationRole::LocationManager)
        ->and(seededLocationRole($playaAccount, $beachLocation, $multiAccountUser))
        ->toBe(LocationRole::FrontDesk)
        ->and(StaffMembership::query()->whereNotNull('account_role')->count())->toBe(1)
        ->and(StaffLocationRole::query()->count())->toBe(5)
        ->and(StaffMembership::query()->count())->toBe(6);

    // The deactivated demo user is suspended in wasiy-demo only: the
    // membership is deactivated, the User can still log in, and the role
    // row stays so the staff list shows them dimmed.
    $deactivated = User::query()->where('email', 'deactivated@wasiy.test')->sole();
    $suspendedMembership = StaffMembership::query()
        ->where('account_id', $demoAccount->id)
        ->where('user_id', $deactivated->id)
        ->sole();

    expect($deactivated->isDeactivated())->toBeFalse()
        ->and($suspendedMembership->isDeactivated())->toBeTrue()
        ->and(seededLocationRole($demoAccount, $northTower, $deactivated))
        ->toBe(LocationRole::FrontDesk);
});

function seededLocationRole(Account $account, Location $location, User $user): LocationRole
{
    return StaffLocationRole::query()
        ->where('account_id', $account->id)
        ->where('location_id', $location->id)
        ->whereHas('membership', fn ($query) => $query->where('user_id', $user->id))
        ->sole()
        ->role;
}

test('seeded users expose the final m2 access context scenarios', function () {
    $this->seed();

    $demoAccount = Account::query()->where('slug', 'wasiy-demo')->sole();
    $playaAccount = Account::query()->where('slug', 'wasiy-playa')->sole();
    $centralLocation = Location::query()->where('slug', 'edificio-central')->sole();
    $northTower = Location::query()->where('slug', 'torre-norte')->sole();
    $beachLocation = Location::query()->where('slug', 'edificio-playa')->sole();
    $valleLocation = Location::query()->where('slug', 'condominio-valle')->sole();
    $demoLocationCount = Location::query()->where('account_id', $demoAccount->id)->count();

    $admin = User::query()->where('email', 'admin@wasiy.test')->sole();
    $manager = User::query()->where('email', 'manager@wasiy.test')->sole();
    $frontDesk = User::query()->where('email', 'frontdesk@wasiy.test')->sole();
    $multiAccountUser = User::query()->where('email', 'multi@wasiy.test')->sole();

    // An admin with several Locations gets the first by name selected for
    // them, so the location-scoped surface is usable without a picker.
    $this->actingAs($admin)
        ->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('active_account.id', $demoAccount->id)
        ->assertJsonPath('active_location.id', $valleLocation->id)
        ->assertJsonPath('roles.account.0.role', AccountRole::AccountAdmin->value)
        ->assertJsonCount($demoLocationCount, 'accessible_locations');

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
    Notification::fake();
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

    $invitation = UserInvitation::query()->where('email', 'slice7.staff@wasiy.test')->sole();
    $token = null;

    Notification::assertSentOnDemand(
        StaffInvitationNotification::class,
        function (StaffInvitationNotification $notification) use (&$token): bool {
            if ($notification->invitation->email !== 'slice7.staff@wasiy.test') {
                return false;
            }

            $token = $notification->token;

            return true;
        },
    );

    // The invitee has no access yet; accepting is what creates them.
    expect(User::query()->where('email', 'slice7.staff@wasiy.test')->exists())->toBeFalse();

    app('auth')->forgetGuards();

    $this->postJson("/api/staff-invitations/{$token}/accept", [
        'password' => 'a-strong-password',
        'password_confirmation' => 'a-strong-password',
    ])->assertOk();

    $staff = User::query()->where('email', 'slice7.staff@wasiy.test')->sole();

    // Promotion is one atomic access update; it also removes the front-desk
    // assignment the invitation granted, which logs its own activity row.
    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/access", [
            'account_role' => AccountRole::AccountAdmin->value,
            'location_assignments' => [],
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(4)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::StaffInvited->value)->sole()->metadata)
        ->toMatchArray([
            'invitation_id' => $invitation->id,
            'invitation_email' => 'slice7.staff@wasiy.test',
            'account_id' => $account->id,
        ])
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::StaffInvitationAccepted->value)->sole()->metadata)
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

test('it seeds every invitation state idempotently with resolvable tokens', function () {
    $this->seed();
    $this->seed();

    $account = Account::query()->where('slug', 'wasiy-demo')->sole();

    $staffInvitations = UserInvitation::query()
        ->where('account_id', $account->id)
        ->where('purpose', UserInvitationPurpose::Staff)
        ->pluck('status', 'email');

    expect($staffInvitations)->toHaveCount(3)
        ->and($staffInvitations['staff.invitado@wasiy.test'])->toBe(UserInvitationStatus::Pending)
        ->and($staffInvitations['staff.vencido@wasiy.test'])->toBe(UserInvitationStatus::Expired)
        ->and($staffInvitations['staff.cancelado@wasiy.test'])->toBe(UserInvitationStatus::Cancelled);

    $residentStatuses = UserInvitation::query()
        ->where('account_id', $account->id)
        ->where('purpose', UserInvitationPurpose::Resident)
        ->pluck('status')
        ->map(fn (UserInvitationStatus $status): string => $status->value)
        ->sort()
        ->values()
        ->all();

    expect($residentStatuses)->toBe([
        UserInvitationStatus::Accepted->value,
        UserInvitationStatus::Pending->value,
    ]);

    // The pending Staff token is fixed so the acceptance page can be opened by
    // hand, and it must resolve through the real endpoint.
    $this->getJson('/api/staff-invitations/staff-demo-invitation-token')
        ->assertOk()
        ->assertJsonPath('data.email', 'staff.invitado@wasiy.test')
        ->assertJsonPath('data.requires_account_creation', true)
        ->assertJsonPath('data.roles.locations.0.role', LocationRole::FrontDesk->value);

    $this->getJson('/api/resident-invitations/resident-demo-invitation-token')->assertOk();

    // Non-pending states are terminal at the token endpoints.
    $this->getJson('/api/staff-invitations/staff-expired-invitation-token')->assertGone();
    $this->getJson('/api/staff-invitations/staff-cancelled-invitation-token')->assertGone();
    $this->getJson('/api/resident-invitations/resident-accepted-invitation-token')->assertGone();
});

test('factory built invitations can be resolved by their token', function () {
    $account = Account::factory()->create();

    ['invitation' => $invitation, 'token' => $token] = UserInvitation::factory()
        ->for($account)
        ->createWithToken(['email' => 'factory@wasiy.test']);

    $resolved = app(UserInvitationTokenResolver::class)
        ->resolve($token, UserInvitationPurpose::Staff);

    expect($resolved->id)->toBe($invitation->id);

    // The purpose and status helpers compose with the token helper.
    ['token' => $residentToken] = UserInvitation::factory()
        ->for($account)
        ->resident()
        ->createWithToken(['email' => 'factory.resident@wasiy.test']);

    expect(
        app(UserInvitationTokenResolver::class)
            ->resolve($residentToken, UserInvitationPurpose::Resident)
            ->purpose,
    )->toBe(UserInvitationPurpose::Resident);
});
