<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

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
        ->assertJsonPath('data.staff.email', 'ana.salas@wasiy.test')
        ->assertJsonPath('data.staff.location_assignments.0.location_id', $location->id)
        ->assertJsonPath('data.staff.location_assignments.0.role', LocationRole::FrontDesk->value)
        ->assertJsonPath('data.invitation.email', 'ana.salas@wasiy.test')
        ->assertJsonPath('data.invitation.purpose', UserInvitationPurpose::Staff->value)
        ->assertJsonPath('data.invitation.status', UserInvitationStatus::Pending->value)
        ->assertJsonMissing(['token_hash']);

    $staff = User::query()->where('email', 'ana.salas@wasiy.test')->sole();

    $this->assertDatabaseHas('location_user_roles', [
        'account_id' => $account->id,
        'location_id' => $location->id,
        'user_id' => $staff->id,
        'role' => LocationRole::FrontDesk->value,
    ]);

    $invitation = UserInvitation::query()->where('email', 'ana.salas@wasiy.test')->sole();

    expect($invitation->user_id)->toBe($staff->id)
        ->and($invitation->invited_by_user_id)->toBe($admin->id)
        ->and($invitation->location_id)->toBeNull()
        ->and($invitation->token_hash)->not->toBeEmpty()
        ->and($invitation->expires_at->isSameDay(now()->addDays(21)))->toBeTrue()
        ->and($staff->email_verified_at)->toBeNull();
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
        ->assertJsonPath('data.staff.id', $existingUser->id)
        ->assertJsonPath('data.staff.name', 'Existing Person')
        ->assertJsonPath('data.invitation.first_name', 'Invited')
        ->assertJsonPath('data.invitation.last_name', 'Name');

    expect($existingUser->fresh()->name)->toBe('Existing Person');
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
