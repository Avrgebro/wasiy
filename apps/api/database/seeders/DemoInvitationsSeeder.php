<?php

namespace Database\Seeders;

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\Location;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Covers every invitation state so each one is reachable while browsing
 * locally. Tokens are fixed strings, so the acceptance pages can be opened
 * by hand at /invitations/{staff,resident}/{token}. Depends on
 * DemoAccountsSeeder and DemoRegistrySeeder.
 */
class DemoInvitationsSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $account = Account::query()->where('slug', 'wasiy-demo')->firstOrFail();
        $centralLocation = Location::query()->where('slug', 'edificio-central')->firstOrFail();
        $northTower = Location::query()->where('slug', 'torre-norte')->firstOrFail();
        $manager = User::query()->where('email', 'manager@wasiy.test')->firstOrFail();
        $claimedResident = Resident::query()->where('email', 'resident@wasiy.test')->firstOrFail();
        $invitedResident = Resident::query()->where('email', 'invited.resident@wasiy.test')->firstOrFail();

        $this->pendingResidentInvitation($account, $centralLocation, $invitedResident, $manager);

        $this->staffInvitation($account, 'staff.invitado@wasiy.test', 'staff-demo-invitation-token', $manager, [
            'first_name' => 'Sofia',
            'last_name' => 'Invitada',
            'status' => UserInvitationStatus::Pending,
            'expires_at' => now()->addDays(UserInvitationPurpose::Staff->expiresDays()),
            'role_assignments' => [
                'account_role' => null,
                'location_assignments' => [
                    ['location_id' => $northTower->id, 'role' => LocationRole::FrontDesk->value],
                ],
            ],
        ]);

        $this->staffInvitation($account, 'staff.vencido@wasiy.test', 'staff-expired-invitation-token', $manager, [
            'first_name' => 'Bruno',
            'last_name' => 'Vencido',
            'status' => UserInvitationStatus::Expired,
            'expires_at' => now()->subDays(3),
            'role_assignments' => [
                'account_role' => AccountRole::AccountAdmin->value,
                'location_assignments' => [],
            ],
        ]);

        $this->staffInvitation($account, 'staff.cancelado@wasiy.test', 'staff-cancelled-invitation-token', $manager, [
            'first_name' => 'Nadia',
            'last_name' => 'Cancelada',
            'status' => UserInvitationStatus::Cancelled,
            'expires_at' => now()->addDays(7),
            'role_assignments' => [
                'account_role' => null,
                'location_assignments' => [
                    ['location_id' => $centralLocation->id, 'role' => LocationRole::LocationManager->value],
                ],
            ],
        ]);

        // The already-claimed portal resident, with the invitation that let
        // them in still on record.
        UserInvitation::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'resident_id' => $claimedResident->id,
                'purpose' => UserInvitationPurpose::Resident,
            ],
            [
                'location_id' => $centralLocation->id,
                'user_id' => $claimedResident->user_id,
                'email' => $claimedResident->email,
                'first_name' => $claimedResident->first_name,
                'last_name' => $claimedResident->last_name,
                'token_hash' => hash('sha256', 'resident-accepted-invitation-token'),
                'status' => UserInvitationStatus::Accepted,
                'expires_at' => now()->subDays(20),
                'accepted_at' => now()->subDays(25),
                'invited_by_user_id' => $manager->id,
            ],
        );
    }

    private function pendingResidentInvitation(Account $account, Location $location, Resident $resident, User $manager): UserInvitation
    {
        return UserInvitation::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'resident_id' => $resident->id,
                'purpose' => UserInvitationPurpose::Resident,
            ],
            [
                'location_id' => $location->id,
                'user_id' => null,
                'email' => $resident->email,
                'first_name' => $resident->first_name,
                'last_name' => $resident->last_name,
                'token_hash' => hash('sha256', 'resident-demo-invitation-token'),
                'status' => UserInvitationStatus::Pending,
                'expires_at' => now()->addDays(UserInvitationPurpose::Resident->expiresDays()),
                'accepted_at' => null,
                'invited_by_user_id' => $manager->id,
            ],
        );
    }

    /**
     * @param  array{first_name: string, last_name: string, status: UserInvitationStatus, expires_at: mixed, role_assignments: array<string, mixed>}  $attributes
     */
    private function staffInvitation(
        Account $account,
        string $email,
        string $token,
        User $manager,
        array $attributes,
    ): UserInvitation {
        return UserInvitation::query()->updateOrCreate(
            [
                'account_id' => $account->id,
                'email' => $email,
                'purpose' => UserInvitationPurpose::Staff,
            ],
            [
                'location_id' => null,
                'user_id' => null,
                'resident_id' => null,
                'first_name' => $attributes['first_name'],
                'last_name' => $attributes['last_name'],
                'token_hash' => hash('sha256', $token),
                'role_assignments' => $attributes['role_assignments'],
                'status' => $attributes['status'],
                'expires_at' => $attributes['expires_at'],
                'accepted_at' => null,
                'invited_by_user_id' => $manager->id,
            ],
        );
    }
}
