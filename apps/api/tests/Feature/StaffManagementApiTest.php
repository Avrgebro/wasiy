<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\StaffInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

beforeEach(function () {
    Notification::fake();
});

function createAccountAdmin(Account $account): User
{
    $admin = User::factory()->create();

    AccountUserRole::query()->create([
        'account_id' => $account->id,
        'user_id' => $admin->id,
        'role' => AccountRole::AccountAdmin,
    ]);

    return $admin;
}

test('account admins can invite staff users with location assignments', function () {
    config(['wasiy.invitations.staff_expires_days' => 21]);

    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => ' Ana.Salas@Wasiy.Test ',
            'first_name' => 'Ana',
            'last_name' => 'Salas',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.invitation.email', 'ana.salas@wasiy.test')
        ->assertJsonPath('data.invitation.purpose', UserInvitationPurpose::Staff->value)
        ->assertJsonPath('data.invitation.status', UserInvitationStatus::Pending->value)
        ->assertJsonPath('data.invitation.invited_location_assignments.0.location_id', $location->id)
        ->assertJsonPath('data.invitation.invited_location_assignments.0.role', LocationRole::FrontDesk->value)
        ->assertJsonMissing(['token_hash']);

    // Nothing is granted at invite time: no User, no role rows. Access appears
    // only when the invitee accepts.
    expect(User::query()->where('email', 'ana.salas@wasiy.test')->exists())->toBeFalse();
    $this->assertDatabaseCount('location_user_roles', 0);
    $this->assertDatabaseCount('account_user_roles', 1); // the inviting admin

    $invitation = UserInvitation::query()->where('email', 'ana.salas@wasiy.test')->sole();

    expect($invitation->user_id)->toBeNull()
        ->and($invitation->invited_by_user_id)->toBe($admin->id)
        ->and($invitation->location_id)->toBeNull()
        ->and($invitation->token_hash)->not->toBeEmpty()
        ->and($invitation->expires_at->isSameDay(now()->addDays(21)))->toBeTrue()
        ->and($invitation->invitedAccountRole())->toBeNull()
        ->and($invitation->invitedLocationAssignments())->toBe([
            [
                'location_id' => $location->id,
                'role' => LocationRole::FrontDesk->value,
            ],
        ]);

    Notification::assertSentOnDemand(StaffInvitationNotification::class);

    $activityLog = ActivityLog::query()->sole();

    expect($activityLog->account_id)->toBe($account->id)
        ->and($activityLog->location_id)->toBeNull()
        ->and($activityLog->actor_user_id)->toBe($admin->id)
        ->and($activityLog->subject_type)->toBe('user_invitation')
        ->and($activityLog->subject_id)->toBe($invitation->id)
        ->and($activityLog->event_type)->toBe(ActivityEventType::StaffInvited)
        ->and($activityLog->summary)->toBe("Se invitó a Ana Salas al equipo de {$account->name}.")
        ->and($activityLog->metadata)->toMatchArray([
            'actor_user_id' => $admin->id,
            'actor_user_name' => $admin->name,
            'actor_user_email' => $admin->email,
            'account_id' => $account->id,
            'account_name' => $account->name,
            'invitation_id' => $invitation->id,
            'invitation_email' => 'ana.salas@wasiy.test',
            'invited_account_role' => null,
            'invited_location_assignments' => [
                [
                    'location_id' => $location->id,
                    'location_name' => $location->name,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->and($activityLog->metadata)->not->toHaveKey('token_hash')
        ->and($activityLog->metadata)->not->toHaveKey('token');
});

test('location managers cannot invite staff users', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $manager = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'staff@wasiy.test',
            'first_name' => 'Staff',
            'last_name' => 'User',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertForbidden();
});

test('staff invitations require at least one access grant', function () {
    $account = Account::factory()->create();
    $admin = createAccountAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'staff@wasiy.test',
            'first_name' => 'Staff',
            'last_name' => 'User',
            'account_role' => null,
            'location_assignments' => [],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_assignments');
});

test('staff invitations cannot assign locations outside the account', function () {
    $account = Account::factory()->create();
    $otherLocation = Location::factory()->create();
    $admin = createAccountAdmin($account);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'staff@wasiy.test',
            'first_name' => 'Staff',
            'last_name' => 'User',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $otherLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_assignments.0.location_id');
});

test('staff invitations reuse existing active users without overwriting identity fields', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $existingUser = User::factory()->create([
        'first_name' => 'Existing',
        'last_name' => 'Person',
        'email' => 'existing@wasiy.test',
    ]);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'existing@wasiy.test',
            'first_name' => 'Invited',
            'last_name' => 'Name',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::LocationManager->value,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('data.invitation.first_name', 'Existing')
        ->assertJsonPath('data.invitation.last_name', 'Person');

    // The existing identity is snapshotted and left untouched, and the invite
    // still grants nothing until it is accepted.
    expect($existingUser->fresh()->name)->toBe('Existing Person');
    $this->assertDatabaseCount('location_user_roles', 0);
});

test('staff invitations reject existing deactivated users', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $deactivatedUser = User::factory()->create(['email' => 'inactive@wasiy.test']);
    $deactivatedUser->deactivate();

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'inactive@wasiy.test',
            'first_name' => 'Inactive',
            'last_name' => 'User',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');
});

test('staff invitations reject active duplicate pending invitations and expire stale ones', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    UserInvitation::factory()->create([
        'account_id' => $account->id,
        'email' => 'pending@wasiy.test',
        'purpose' => UserInvitationPurpose::Staff,
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->addDay(),
    ]);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'pending@wasiy.test',
            'first_name' => 'Pending',
            'last_name' => 'User',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    UserInvitation::query()
        ->where('email', 'pending@wasiy.test')
        ->update(['expires_at' => now()->subMinute()]);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'pending@wasiy.test',
            'first_name' => 'Pending',
            'last_name' => 'User',
            'account_role' => null,
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertCreated();

    expect(UserInvitation::query()
        ->where('email', 'pending@wasiy.test')
        ->where('status', UserInvitationStatus::Expired->value)
        ->count())->toBe(1);
});

test('account admins can assign account roles and location roles independently', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $staff = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $firstLocation->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/roles", [
            'account_role' => AccountRole::AccountAdmin->value,
        ])
        ->assertOk()
        ->assertJsonPath('data.account_roles.0', AccountRole::AccountAdmin->value)
        ->assertJsonPath('data.location_assignments.0.location_id', $firstLocation->id);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $firstLocation->id,
                    'role' => LocationRole::LocationManager->value,
                ],
                [
                    'location_id' => $secondLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertOk()
        ->assertJsonPath('data.account_roles.0', AccountRole::AccountAdmin->value)
        ->assertJsonCount(2, 'data.location_assignments');

    $this->assertDatabaseHas('location_user_roles', [
        'account_id' => $account->id,
        'location_id' => $firstLocation->id,
        'user_id' => $staff->id,
        'role' => LocationRole::LocationManager->value,
    ]);
});

test('account role changes create scoped activity rows and skip no op updates', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $staff = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Salas']);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/roles", [
            'account_role' => AccountRole::AccountAdmin->value,
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(1);

    $assignedLog = ActivityLog::query()->sole();

    expect($assignedLog->event_type)->toBe(ActivityEventType::StaffRoleAssigned)
        ->and($assignedLog->account_id)->toBe($account->id)
        ->and($assignedLog->location_id)->toBeNull()
        ->and($assignedLog->actor_user_id)->toBe($admin->id)
        ->and($assignedLog->subject_type)->toBe('user')
        ->and($assignedLog->subject_id)->toBe($staff->id)
        ->and($assignedLog->metadata)->toMatchArray([
            'account_role_before' => null,
            'account_role_after' => AccountRole::AccountAdmin->value,
            'staff_user_id' => $staff->id,
            'staff_user_name' => 'Ana Salas',
            'staff_user_email' => $staff->email,
            'account_id' => $account->id,
            'account_name' => $account->name,
            'actor_user_id' => $admin->id,
            'actor_user_name' => $admin->name,
            'actor_user_email' => $admin->email,
        ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/roles", [
            'account_role' => AccountRole::AccountAdmin->value,
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(1);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/roles", [
            'account_role' => null,
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(2);

    $removedLog = ActivityLog::query()
        ->where('event_type', ActivityEventType::StaffRoleRemoved->value)
        ->sole();

    expect($removedLog->location_id)->toBeNull()
        ->and($removedLog->metadata)->toMatchArray([
            'account_role_before' => AccountRole::AccountAdmin->value,
            'account_role_after' => null,
        ]);
});

test('location assignment updates create one activity row per changed location and skip no ops', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create(['name' => 'Torre Norte']);
    $secondLocation = Location::factory()->for($account)->create(['name' => 'Torre Sur']);
    $admin = createAccountAdmin($account);
    $staff = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Salas']);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $firstLocation->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $firstLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
                [
                    'location_id' => $secondLocation->id,
                    'role' => LocationRole::LocationManager->value,
                ],
            ],
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(1);

    $assignedLog = ActivityLog::query()->sole();

    expect($assignedLog->event_type)->toBe(ActivityEventType::StaffRoleAssigned)
        ->and($assignedLog->account_id)->toBe($account->id)
        ->and($assignedLog->location_id)->toBe($secondLocation->id)
        ->and($assignedLog->actor_user_id)->toBe($admin->id)
        ->and($assignedLog->subject_type)->toBe('user')
        ->and($assignedLog->subject_id)->toBe($staff->id)
        ->and($assignedLog->metadata)->toMatchArray([
            'location_id' => $secondLocation->id,
            'location_name' => 'Torre Sur',
            'location_role_before' => null,
            'location_role_after' => LocationRole::LocationManager->value,
            'staff_user_id' => $staff->id,
            'staff_user_name' => 'Ana Salas',
            'staff_user_email' => $staff->email,
            'account_id' => $account->id,
            'account_name' => $account->name,
            'actor_user_id' => $admin->id,
            'actor_user_name' => $admin->name,
            'actor_user_email' => $admin->email,
        ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $firstLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
                [
                    'location_id' => $secondLocation->id,
                    'role' => LocationRole::LocationManager->value,
                ],
            ],
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(1);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $firstLocation->id,
                    'role' => LocationRole::LocationManager->value,
                ],
            ],
        ])
        ->assertOk();

    expect(ActivityLog::query()->count())->toBe(3);

    $changedLog = ActivityLog::query()
        ->where('event_type', ActivityEventType::StaffLocationsChanged->value)
        ->sole();
    $removedLog = ActivityLog::query()
        ->where('event_type', ActivityEventType::StaffRoleRemoved->value)
        ->sole();

    expect($changedLog->location_id)->toBe($firstLocation->id)
        ->and($changedLog->metadata)->toMatchArray([
            'location_id' => $firstLocation->id,
            'location_name' => 'Torre Norte',
            'location_role_before' => LocationRole::FrontDesk->value,
            'location_role_after' => LocationRole::LocationManager->value,
        ])
        ->and($removedLog->location_id)->toBe($secondLocation->id)
        ->and($removedLog->metadata)->toMatchArray([
            'location_id' => $secondLocation->id,
            'location_name' => 'Torre Sur',
            'location_role_before' => LocationRole::LocationManager->value,
            'location_role_after' => null,
        ]);
});

test('location assignment updates reject duplicate and cross account locations', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $otherLocation = Location::factory()->create();
    $admin = createAccountAdmin($account);
    $staff = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
                [
                    'location_id' => $location->id,
                    'role' => LocationRole::LocationManager->value,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_assignments.1.location_id');

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $otherLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_assignments.0.location_id');
});

test('staff assignment updates can remove all account access grants', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $staff = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [],
        ])
        ->assertOk()
        ->assertJsonCount(0, 'data.location_assignments');

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/staff")
        ->assertOk()
        ->assertJsonMissing(['id' => $staff->id]);
});

test('staff assignment updates reject non staff users', function () {
    $account = Account::factory()->create();
    $admin = createAccountAdmin($account);
    $outsider = User::factory()->create();

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$outsider->id}/roles", [
            'account_role' => AccountRole::AccountAdmin->value,
        ])
        ->assertNotFound();
});

test('staff assignment updates prevent removing the only remaining account admin from themselves', function () {
    $account = Account::factory()->create();
    $admin = createAccountAdmin($account);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$admin->id}/roles", [
            'account_role' => null,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('account_role');

    $otherAdmin = createAccountAdmin($account);

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$admin->id}/roles", [
            'account_role' => null,
        ])
        ->assertOk()
        ->assertJsonCount(0, 'data.account_roles');

    $this->assertDatabaseHas('account_user_roles', [
        'account_id' => $account->id,
        'user_id' => $otherAdmin->id,
        'role' => AccountRole::AccountAdmin->value,
    ]);
});

test('an actor demoted after authorization cannot demote the remaining admin', function () {
    $account = Account::factory()->create();
    $demotedActor = createAccountAdmin($account);
    $remainingAdmin = createAccountAdmin($account);

    // Simulate the race: the actor passed the route's manageStaff check, then
    // a concurrent request removed their admin role before this transaction.
    AccountUserRole::query()
        ->where('account_id', $account->id)
        ->where('user_id', $demotedActor->id)
        ->delete();

    expect(fn () => app(App\Actions\Staff\UpdateStaffAccountRole::class)
        ->handle($account, $demotedActor, $remainingAdmin, null))
        ->toThrow(Symfony\Component\HttpKernel\Exception\HttpException::class);

    $this->assertDatabaseHas('account_user_roles', [
        'account_id' => $account->id,
        'user_id' => $remainingAdmin->id,
        'role' => AccountRole::AccountAdmin->value,
    ]);
});

test('deactivated staff users cannot be granted new roles but can have roles removed', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create();
    $secondLocation = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $staff = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $firstLocation->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $staff->deactivate();

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/roles", [
            'account_role' => AccountRole::AccountAdmin->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('account_role');

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [
                [
                    'location_id' => $firstLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
                [
                    'location_id' => $secondLocation->id,
                    'role' => LocationRole::FrontDesk->value,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('location_assignments');

    $this->actingAs($admin)
        ->patchJson("/api/accounts/{$account->id}/staff/{$staff->id}/locations", [
            'location_assignments' => [],
        ])
        ->assertOk()
        ->assertJsonCount(0, 'data.location_assignments');
});

test('staff list is admin only paginated and filters by explicit role and location assignments', function () {
    $account = Account::factory()->create();
    $firstLocation = Location::factory()->for($account)->create(['name' => 'Alpha']);
    $secondLocation = Location::factory()->for($account)->create(['name' => 'Beta']);
    $admin = createAccountAdmin($account);
    $manager = User::factory()->create(['first_name' => 'Maria', 'last_name' => 'Manager']);
    $frontDesk = User::factory()->create(['first_name' => 'Felipe', 'last_name' => 'Desk']);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $firstLocation->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    LocationUserRole::query()->create([
        'account_id' => $account->id,
        'location_id' => $secondLocation->id,
        'user_id' => $frontDesk->id,
        'role' => LocationRole::FrontDesk,
    ]);

    $this->actingAs($manager)
        ->getJson("/api/accounts/{$account->id}/staff")
        ->assertForbidden();

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/staff?per_page=2")
        ->assertOk()
        ->assertJsonPath('meta.per_page', 2)
        ->assertJsonPath('meta.total', 3);

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/staff?role=".LocationRole::FrontDesk->value)
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $frontDesk->id);

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/staff?location_id={$firstLocation->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $manager->id);

    $this->actingAs($admin)
        ->getJson('/api/accounts/'.$account->id.'/staff?search=maria')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $manager->id);
});

function inviteStaffAndCaptureToken(Account $account, User $admin, array $payload): string
{
    test()->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", $payload)
        ->assertCreated();

    $token = null;

    Notification::assertSentOnDemand(
        StaffInvitationNotification::class,
        function (StaffInvitationNotification $notification) use (&$token): bool {
            $token = $notification->token;

            return true;
        },
    );

    app('auth')->forgetGuards();

    return $token;
}

test('accepting a staff invitation creates the user and applies every role', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'nueva@wasiy.test',
        'first_name' => 'Nueva',
        'last_name' => 'Persona',
        'account_role' => AccountRole::AccountAdmin->value,
        'location_assignments' => [
            ['location_id' => $location->id, 'role' => LocationRole::LocationManager->value],
        ],
    ]);

    $this->getJson("/api/staff-invitations/{$token}")
        ->assertOk()
        ->assertJsonPath('data.email', 'nueva@wasiy.test')
        ->assertJsonPath('data.requires_account_creation', true)
        ->assertJsonPath('data.account.name', $account->name)
        ->assertJsonPath('data.roles.account_role', AccountRole::AccountAdmin->value)
        ->assertJsonPath('data.roles.locations.0.name', $location->name)
        ->assertJsonMissingPath('data.token_hash');

    $this->withHeader('Origin', 'http://localhost:5174')
        ->postJson("/api/staff-invitations/{$token}/accept", [
            'password' => 'a-strong-password',
            'password_confirmation' => 'a-strong-password',
        ])
        ->assertOk()
        ->assertJsonPath('data.skipped_location_ids', [])
        ->assertJsonPath('data.session.user.email', 'nueva@wasiy.test');

    $staff = User::query()->where('email', 'nueva@wasiy.test')->sole();

    $this->assertAuthenticatedAs($staff);
    $this->assertDatabaseHas('account_user_roles', [
        'account_id' => $account->id,
        'user_id' => $staff->id,
        'role' => AccountRole::AccountAdmin->value,
    ]);
    $this->assertDatabaseHas('location_user_roles', [
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $staff->id,
        'role' => LocationRole::LocationManager->value,
    ]);

    $invitation = UserInvitation::query()->where('email', 'nueva@wasiy.test')->sole();

    expect($invitation->status)->toBe(UserInvitationStatus::Accepted)
        ->and($invitation->user_id)->toBe($staff->id)
        ->and($invitation->accepted_at)->not->toBeNull();

    expect(ActivityLog::query()
        ->where('event_type', ActivityEventType::StaffInvitationAccepted->value)
        ->count())->toBe(1);
});

test('accepting twice is gone', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'once@wasiy.test',
        'first_name' => 'Once',
        'last_name' => 'Only',
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $location->id, 'role' => LocationRole::FrontDesk->value],
        ],
    ]);

    $payload = [
        'password' => 'a-strong-password',
        'password_confirmation' => 'a-strong-password',
    ];

    $this->postJson("/api/staff-invitations/{$token}/accept", $payload)->assertOk();

    $this->app['auth']->forgetGuards();

    $this->postJson("/api/staff-invitations/{$token}/accept", $payload)->assertGone();
});

test('an existing user must be signed in as themselves to accept', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    $existing = User::factory()->create(['email' => 'veteran@wasiy.test']);
    $someoneElse = User::factory()->create();

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'veteran@wasiy.test',
        'first_name' => 'Veteran',
        'last_name' => 'Staffer',
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $location->id, 'role' => LocationRole::FrontDesk->value],
        ],
    ]);

    $this->getJson("/api/staff-invitations/{$token}")
        ->assertOk()
        ->assertJsonPath('data.requires_account_creation', false);

    // Unauthenticated: the SPA is told to send them through login.
    $this->postJson("/api/staff-invitations/{$token}/accept")->assertUnauthorized();

    // Signed in as the wrong person.
    $this->actingAs($someoneElse)
        ->postJson("/api/staff-invitations/{$token}/accept")
        ->assertStatus(409);

    $this->assertDatabaseCount('location_user_roles', 0);

    // Signed in as the invitee.
    $this->actingAs($existing)
        ->postJson("/api/staff-invitations/{$token}/accept")
        ->assertOk();

    $this->assertDatabaseHas('location_user_roles', [
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $existing->id,
        'role' => LocationRole::FrontDesk->value,
    ]);
});

test('a location deleted before acceptance is skipped rather than fatal', function () {
    $account = Account::factory()->create();
    $liveLocation = Location::factory()->for($account)->create();
    $doomedLocation = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'partial@wasiy.test',
        'first_name' => 'Partial',
        'last_name' => 'Grant',
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $liveLocation->id, 'role' => LocationRole::FrontDesk->value],
            ['location_id' => $doomedLocation->id, 'role' => LocationRole::LocationManager->value],
        ],
    ]);

    $doomedLocation->delete();

    $this->postJson("/api/staff-invitations/{$token}/accept", [
        'password' => 'a-strong-password',
        'password_confirmation' => 'a-strong-password',
    ])
        ->assertOk()
        ->assertJsonPath('data.skipped_location_ids', [$doomedLocation->id]);

    $staff = User::query()->where('email', 'partial@wasiy.test')->sole();

    $this->assertDatabaseHas('location_user_roles', [
        'location_id' => $liveLocation->id,
        'user_id' => $staff->id,
    ]);
    $this->assertDatabaseMissing('location_user_roles', [
        'location_id' => $doomedLocation->id,
        'user_id' => $staff->id,
    ]);
});

test('an invitation whose only location is gone cannot be accepted', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'empty@wasiy.test',
        'first_name' => 'Empty',
        'last_name' => 'Grant',
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $location->id, 'role' => LocationRole::FrontDesk->value],
        ],
    ]);

    $location->delete();

    $this->postJson("/api/staff-invitations/{$token}/accept", [
        'password' => 'a-strong-password',
        'password_confirmation' => 'a-strong-password',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('token');

    expect(User::query()->where('email', 'empty@wasiy.test')->exists())->toBeFalse();
});

test('the staff list surfaces pending invitations separately from active staff', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'waiting@wasiy.test',
        'first_name' => 'Waiting',
        'last_name' => 'Person',
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $location->id, 'role' => LocationRole::FrontDesk->value],
        ],
    ]);

    $response = $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/staff")
        ->assertOk()
        ->assertJsonPath('pending_invitations.0.email', 'waiting@wasiy.test')
        ->assertJsonPath('pending_invitations.0.invited_by.name', $admin->name)
        ->assertJsonPath(
            'pending_invitations.0.invited_location_assignments.0.role',
            LocationRole::FrontDesk->value,
        );

    // The invitee holds no roles, so they are absent from the staff list itself.
    $staffEmails = collect($response->json('data'))->pluck('email');

    expect($staffEmails)->not->toContain('waiting@wasiy.test')
        ->and($staffEmails)->toContain($admin->email);
});

test('cancelling a pending staff invitation kills its token', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'revoked@wasiy.test',
        'first_name' => 'Revoked',
        'last_name' => 'Person',
        'account_role' => AccountRole::AccountAdmin->value,
        'location_assignments' => [],
    ]);

    $invitation = UserInvitation::query()->where('email', 'revoked@wasiy.test')->sole();

    $this->actingAs($admin)
        ->deleteJson("/api/accounts/{$account->id}/staff/invitations/{$invitation->id}")
        ->assertOk()
        ->assertJsonPath('data.invitation.status', UserInvitationStatus::Cancelled->value);

    app('auth')->forgetGuards();

    $this->getJson("/api/staff-invitations/{$token}")->assertGone();
    $this->postJson("/api/staff-invitations/{$token}/accept", [
        'password' => 'a-strong-password',
        'password_confirmation' => 'a-strong-password',
    ])->assertGone();

    expect(ActivityLog::query()
        ->where('event_type', ActivityEventType::StaffInvitationCancelled->value)
        ->count())->toBe(1);

    // Cancelling frees the pending-unique slot for a fresh invitation.
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations", [
            'email' => 'revoked@wasiy.test',
            'first_name' => 'Revoked',
            'last_name' => 'Person',
            'account_role' => AccountRole::AccountAdmin->value,
            'location_assignments' => [],
        ])
        ->assertCreated();
});

test('resending a staff invitation invalidates the previous token', function () {
    $account = Account::factory()->create();
    $admin = createAccountAdmin($account);

    $firstToken = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'resend@wasiy.test',
        'first_name' => 'Resend',
        'last_name' => 'Person',
        'account_role' => AccountRole::AccountAdmin->value,
        'location_assignments' => [],
    ]);

    $invitation = UserInvitation::query()->where('email', 'resend@wasiy.test')->sole();

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations/{$invitation->id}/resend")
        ->assertOk()
        ->assertJsonPath('data.invitation.status', UserInvitationStatus::Pending->value);

    $secondToken = null;

    Notification::assertSentOnDemandTimes(StaffInvitationNotification::class, 2);
    Notification::assertSentOnDemand(
        StaffInvitationNotification::class,
        function (StaffInvitationNotification $notification) use (&$secondToken, $firstToken): bool {
            if ($notification->token === $firstToken) {
                return false;
            }

            $secondToken = $notification->token;

            return true;
        },
    );

    app('auth')->forgetGuards();

    $this->getJson("/api/staff-invitations/{$firstToken}")->assertGone();
    $this->getJson("/api/staff-invitations/{$secondToken}")->assertOk();
});

test('invitation cancel and resend are scoped to the account and to admins', function () {
    $account = Account::factory()->create();
    $otherAccount = Account::factory()->create();
    $admin = createAccountAdmin($account);
    $otherAdmin = createAccountAdmin($otherAccount);

    inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'scoped@wasiy.test',
        'first_name' => 'Scoped',
        'last_name' => 'Person',
        'account_role' => AccountRole::AccountAdmin->value,
        'location_assignments' => [],
    ]);

    $invitation = UserInvitation::query()->where('email', 'scoped@wasiy.test')->sole();

    // Reaching another Account's invitation through your own Account 404s.
    $this->actingAs($otherAdmin)
        ->deleteJson("/api/accounts/{$otherAccount->id}/staff/invitations/{$invitation->id}")
        ->assertNotFound();

    // Reaching it through the owning Account is a plain authorization failure.
    $this->actingAs($otherAdmin)
        ->deleteJson("/api/accounts/{$account->id}/staff/invitations/{$invitation->id}")
        ->assertForbidden();

    expect($invitation->fresh()->status)->toBe(UserInvitationStatus::Pending);
});

test('an already cancelled invitation cannot be cancelled or resent again', function () {
    $account = Account::factory()->create();
    $admin = createAccountAdmin($account);

    inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'twice@wasiy.test',
        'first_name' => 'Twice',
        'last_name' => 'Person',
        'account_role' => AccountRole::AccountAdmin->value,
        'location_assignments' => [],
    ]);

    $invitation = UserInvitation::query()->where('email', 'twice@wasiy.test')->sole();

    $this->actingAs($admin)
        ->deleteJson("/api/accounts/{$account->id}/staff/invitations/{$invitation->id}")
        ->assertOk();

    $this->actingAs($admin)
        ->deleteJson("/api/accounts/{$account->id}/staff/invitations/{$invitation->id}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('invitation');

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/staff/invitations/{$invitation->id}/resend")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('invitation');
});

test('expected invitation outcomes are not reported to the logs', function () {
    Illuminate\Support\Facades\Exceptions::fake();

    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = createAccountAdmin($account);
    User::factory()->create(['email' => 'quiet@wasiy.test']);

    $token = inviteStaffAndCaptureToken($account, $admin, [
        'email' => 'quiet@wasiy.test',
        'first_name' => 'Quiet',
        'last_name' => 'Logs',
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $location->id, 'role' => LocationRole::FrontDesk->value],
        ],
    ]);

    app('auth')->forgetGuards();

    $this->postJson("/api/staff-invitations/{$token}/accept")->assertUnauthorized();

    Illuminate\Support\Facades\Exceptions::assertNotReported(App\Exceptions\InvitationException::class);
});
