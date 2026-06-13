<?php

use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\ResidentType;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\ResidentInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

function createResidentInvitationManager(Location $location): User
{
    $manager = User::factory()->create();

    LocationUserRole::query()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'user_id' => $manager->id,
        'role' => LocationRole::LocationManager,
    ]);

    return $manager;
}

test('manager can invite a resident in an accessible location', function () {
    Notification::fake();
    config(['wasiy.invitations.resident_expires_days' => 21]);

    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $resident = Resident::factory()->for($location->account)->create([
        'first_name' => 'Rosa',
        'last_name' => 'Diaz',
        'email' => 'rosa.diaz@wasiy.test',
    ]);
    UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($location->account)
        ->for($location)
        ->create(['resident_type' => ResidentType::Owner]);
    $manager = createResidentInvitationManager($location);

    $this->actingAs($manager)
        ->postJson("/api/residents/{$resident->id}/invitations")
        ->assertCreated()
        ->assertJsonPath('data.resident.id', $resident->id)
        ->assertJsonPath('data.invitation.email', 'rosa.diaz@wasiy.test')
        ->assertJsonPath('data.invitation.purpose', UserInvitationPurpose::Resident->value)
        ->assertJsonPath('data.invitation.status', UserInvitationStatus::Pending->value)
        ->assertJsonMissingPath('data.invitation.token')
        ->assertJsonMissingPath('data.invitation.token_hash');

    $invitation = UserInvitation::query()->where('resident_id', $resident->id)->sole();

    expect($invitation->account_id)->toBe($location->account_id)
        ->and($invitation->location_id)->toBe($location->id)
        ->and($invitation->user_id)->toBeNull()
        ->and($invitation->token_hash)->not->toBeEmpty()
        ->and($invitation->expires_at->isSameDay(now()->addDays(21)))->toBeTrue();

    Notification::assertSentOnDemand(ResidentInvitationNotification::class);

    expect(ActivityLog::query()->sole()->event_type)->toBe(ActivityEventType::ResidentInvited);
});

test('location manager cannot invite resident outside accessible locations', function () {
    $account = Location::factory()->create()->account;
    $accessibleLocation = Location::factory()->for($account)->create();
    $inaccessibleLocation = Location::factory()->for($account)->create();
    $unit = Unit::factory()->for($account)->for($inaccessibleLocation)->create();
    $resident = Resident::factory()->for($account)->create(['email' => 'outside@wasiy.test']);
    UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($account)
        ->for($inaccessibleLocation)
        ->create();
    $manager = createResidentInvitationManager($accessibleLocation);

    $this->actingAs($manager)
        ->postJson("/api/residents/{$resident->id}/invitations")
        ->assertForbidden();
});

test('claiming a valid resident invitation creates user and links resident', function () {
    Notification::fake();

    $location = Location::factory()->create();
    $unit = Unit::factory()->for($location->account)->for($location)->create();
    $resident = Resident::factory()->for($location->account)->create([
        'first_name' => 'Lucia',
        'last_name' => 'Paz',
        'email' => 'lucia.paz@wasiy.test',
    ]);
    UnitMembership::factory()
        ->for($resident)
        ->for($unit)
        ->for($location->account)
        ->for($location)
        ->create();
    $manager = createResidentInvitationManager($location);

    $this->actingAs($manager)->postJson("/api/residents/{$resident->id}/invitations")->assertCreated();

    $invitation = UserInvitation::query()->where('resident_id', $resident->id)->sole();
    $token = null;

    Notification::assertSentOnDemand(
        ResidentInvitationNotification::class,
        function (ResidentInvitationNotification $notification) use (&$token): bool {
            $token = $notification->token;

            return true;
        },
    );

    $this->getJson("/api/resident-invitations/{$token}")
        ->assertOk()
        ->assertJsonPath('data.email', 'lucia.paz@wasiy.test')
        ->assertJsonPath('data.resident.name', 'Lucia Paz')
        ->assertJsonMissingPath('data.token_hash');

    $this->postJson("/api/resident-invitations/{$token}/claim", [
        'password' => 'new-secure-password',
        'password_confirmation' => 'new-secure-password',
    ])->assertOk()
        ->assertJsonPath('data.resident.id', $resident->id)
        ->assertJsonPath('data.resident.user_id', fn (?string $userId) => is_string($userId));

    $user = User::query()->where('email', 'lucia.paz@wasiy.test')->sole();

    expect(Hash::check('new-secure-password', $user->password))->toBeTrue()
        ->and($resident->fresh()->user_id)->toBe($user->id)
        ->and($invitation->fresh()->status)->toBe(UserInvitationStatus::Accepted)
        ->and($invitation->fresh()->accepted_at)->not->toBeNull();

    expect(ActivityLog::query()->where('event_type', ActivityEventType::ResidentClaimed->value)->count())->toBe(1);
});

test('claiming expired or accepted resident invitations is rejected', function () {
    $resident = Resident::factory()->create(['email' => 'expired@wasiy.test']);

    $expiredToken = 'expired-token';
    UserInvitation::factory()->for($resident->account)->for($resident)->create([
        'email' => 'expired@wasiy.test',
        'first_name' => $resident->first_name,
        'last_name' => $resident->last_name,
        'token_hash' => hash('sha256', $expiredToken),
        'purpose' => UserInvitationPurpose::Resident,
        'status' => UserInvitationStatus::Expired,
        'expires_at' => now()->subDay(),
    ]);

    $acceptedToken = 'accepted-token';
    UserInvitation::factory()->for($resident->account)->for($resident)->create([
        'email' => 'accepted@wasiy.test',
        'first_name' => $resident->first_name,
        'last_name' => $resident->last_name,
        'token_hash' => hash('sha256', $acceptedToken),
        'purpose' => UserInvitationPurpose::Resident,
        'status' => UserInvitationStatus::Accepted,
        'expires_at' => now()->addDay(),
        'accepted_at' => now(),
    ]);

    $this->postJson("/api/resident-invitations/{$expiredToken}/claim", [
        'password' => 'new-secure-password',
        'password_confirmation' => 'new-secure-password',
    ])->assertGone();

    $this->postJson("/api/resident-invitations/{$acceptedToken}/claim", [
        'password' => 'new-secure-password',
        'password_confirmation' => 'new-secure-password',
    ])->assertGone();
});

test('resident invitation token hash and raw token are never exposed from resources', function () {
    $token = 'visible-url-token';
    $resident = Resident::factory()->create(['email' => 'safe@wasiy.test']);

    UserInvitation::factory()->for($resident->account)->for($resident)->create([
        'email' => 'safe@wasiy.test',
        'first_name' => $resident->first_name,
        'last_name' => $resident->last_name,
        'token_hash' => hash('sha256', $token),
        'purpose' => UserInvitationPurpose::Resident,
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->addDay(),
    ]);

    $this->getJson("/api/resident-invitations/{$token}")
        ->assertOk()
        ->assertJsonMissingPath('data.token')
        ->assertJsonMissingPath('data.token_hash')
        ->assertJsonMissingPath('data.invitation.token_hash');
});

test('inactive resident cannot claim portal access', function () {
    $token = 'inactive-resident-token';
    $resident = Resident::factory()->inactive()->create(['email' => 'inactive.resident@wasiy.test']);

    UserInvitation::factory()->for($resident->account)->for($resident)->create([
        'email' => 'inactive.resident@wasiy.test',
        'first_name' => $resident->first_name,
        'last_name' => $resident->last_name,
        'token_hash' => hash('sha256', $token),
        'purpose' => UserInvitationPurpose::Resident,
        'status' => UserInvitationStatus::Pending,
        'expires_at' => now()->addDay(),
    ]);

    $this->postJson("/api/resident-invitations/{$token}/claim", [
        'password' => 'new-secure-password',
        'password_confirmation' => 'new-secure-password',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('token');

    expect($resident->fresh()->user_id)->toBeNull();
});
