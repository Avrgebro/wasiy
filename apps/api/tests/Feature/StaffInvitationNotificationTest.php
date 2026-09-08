<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\StaffInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;

uses(RefreshDatabase::class);

function staffInvitation(Account $account, array $roleAssignments, ?User $invitedBy = null): UserInvitation
{
    return UserInvitation::query()->create([
        'account_id' => $account->id,
        'email' => 'ana.salas@wasiy.test',
        'first_name' => 'Ana',
        'last_name' => 'Salas',
        'token_hash' => hash('sha256', 'token'),
        'purpose' => UserInvitationPurpose::Staff,
        'role_assignments' => $roleAssignments,
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->setDate(2026, 9, 21)->setTime(12, 0),
        'invited_by_user_id' => $invitedBy?->id,
    ]);
}

test('the staff invitation email renders the branded template with role and locations', function () {
    $account = Account::factory()->create(['name' => 'Condominio Los Olivos']);
    $tower = Location::factory()->for($account)->create(['name' => 'Torre Norte']);
    $club = Location::factory()->for($account)->create(['name' => 'Club House']);
    $admin = User::factory()->create(['first_name' => 'María', 'last_name' => 'Pérez']);

    $invitation = staffInvitation($account, [
        'account_role' => null,
        'location_assignments' => [
            ['location_id' => $tower->id, 'role' => LocationRole::FrontDesk->value],
            ['location_id' => $club->id, 'role' => LocationRole::FrontDesk->value],
        ],
    ], $admin);

    $mail = (new StaffInvitationNotification($invitation, 'raw-token'))->toMail(new AnonymousNotifiable);

    expect($mail->subject)->toBe('Te invitaron al equipo de Condominio Los Olivos')
        ->and($mail->view)->toBe('mail.maizzle.staff-invitation');

    $html = (string) $mail->render();

    expect($html)->toContain('Hola Ana,')
        ->toContain('Condominio Los Olivos')
        ->toContain('María Pérez')
        ->toContain('Portería')
        ->toContain('Ubicaciones')
        ->toContain('Club House, Torre Norte')
        ->toContain('21 de septiembre')
        ->toContain(str_replace('{token}', 'raw-token', config('wasiy.invitations.staff_claim_url')))
        ->toContain('Aceptar invitación')
        ->toContain('images/mail/mark-cream.png')
        ->not->toContain('{{');
});

test('a superadmin invitation shows the role without a locations row', function () {
    $account = Account::factory()->create(['name' => 'Condominio Los Olivos']);

    $invitation = staffInvitation($account, [
        'account_role' => AccountRole::AccountAdmin->value,
        'location_assignments' => [],
    ]);

    $html = (string) (new StaffInvitationNotification($invitation, 'raw-token'))
        ->toMail(new AnonymousNotifiable)
        ->render();

    expect($html)->toContain('Superadmin')
        ->not->toContain('Ubicaci')
        ->not->toContain('{{');
});

test('the public invitation endpoints are rate limited per IP', function () {
    foreach (range(1, 20) as $attempt) {
        $this->getJson('/api/staff-invitations/unknown-token')->assertGone();
    }

    $this->getJson('/api/staff-invitations/unknown-token')->assertTooManyRequests();
});
