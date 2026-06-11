<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;

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
        ])->count())->toBe(4)
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
