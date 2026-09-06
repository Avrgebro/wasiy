<?php

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Enums\RegistryStatus;
use App\Enums\UserInvitationStatus;
use App\Models\FinancialMovement;
use App\Models\Location;
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

/**
 * Carlos is the primary contact of 402 with portal access; Lucía is a member with access.
 *
 * @return array{Location, Unit, Resident, Resident, User, User}
 */
function myUnitWorld(): array
{
    $location = Location::factory()->create(['timezone' => 'America/Lima', 'country' => 'PE']);
    $unit = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '402']);
    $carlosUser = User::factory()->create(['email' => 'carlos@x.pe', 'password' => Hash::make('secret-123')]);
    $carlos = Resident::factory()->for($location->account)->create(['user_id' => $carlosUser->id, 'first_name' => 'Carlos', 'last_name' => 'Mendoza', 'email' => 'carlos@x.pe']);
    $lauraUser = User::factory()->create(['email' => 'lucia@x.pe']);
    $lucia = Resident::factory()->for($location->account)->create(['user_id' => $lauraUser->id, 'first_name' => 'Lucía', 'last_name' => 'Mendoza', 'email' => 'lucia@x.pe']);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $carlos->id, 'status' => RegistryStatus::Active, 'is_primary_contact' => true]);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $lucia->id, 'status' => RegistryStatus::Active, 'is_primary_contact' => false]);

    return [$location, $unit, $carlos, $lucia, $carlosUser, $lauraUser];
}

test('every member lists the household; only the primary contact can manage', function () {
    [, $unit, , , $carlosUser, $luciaUser] = myUnitWorld();

    $this->actingAs($carlosUser)->getJson("/api/portal/household?unit_id={$unit->id}")
        ->assertOk()
        ->assertJsonPath('can_manage', true)
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Carlos Mendoza')
        ->assertJsonPath('data.0.is_primary_contact', true)
        ->assertJsonPath('data.0.is_me', true)
        ->assertJsonPath('data.0.portal_state', 'active')
        ->assertJsonPath('data.1.is_me', false);

    $this->actingAs($luciaUser)->getJson("/api/portal/household?unit_id={$unit->id}")
        ->assertOk()->assertJsonPath('can_manage', false)->assertJsonPath('data.1.is_me', true);

    $stranger = User::factory()->create();
    $this->actingAs($stranger)->getJson("/api/portal/household?unit_id={$unit->id}")->assertForbidden();
});

test('the primary contact adds a person, who is invited when an email is given, and a known email attaches instead of duplicating', function () {
    Notification::fake();
    [$location, $unit, , , $carlosUser, $luciaUser] = myUnitWorld();

    $this->actingAs($luciaUser)->postJson('/api/portal/household', ['unit_id' => $unit->id, 'first_name' => 'X', 'last_name' => 'Y', 'resident_type' => 'occupant'])->assertForbidden();

    $this->actingAs($carlosUser)->postJson('/api/portal/household', ['unit_id' => $unit->id, 'first_name' => 'Rosa', 'last_name' => 'Quintana', 'phone' => '951 330 470', 'email' => 'Rosa@correo.com', 'resident_type' => 'occupant'])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Rosa Quintana')
        ->assertJsonPath('data.phone', '+51951330470')
        ->assertJsonPath('data.resident_type', 'occupant')
        ->assertJsonPath('data.portal_state', 'invited')
        ->assertJsonPath('data.is_primary_contact', false);
    Notification::assertSentOnDemand(ResidentInvitationNotification::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'rosa@correo.com');
    expect(Resident::query()->where('email', 'rosa@correo.com')->count())->toBe(1);

    // Without email: in the registry, no portal.
    $this->actingAs($carlosUser)->postJson('/api/portal/household', ['unit_id' => $unit->id, 'first_name' => 'Tomás', 'last_name' => 'Quintana', 'resident_type' => 'occupant'])
        ->assertCreated()->assertJsonPath('data.portal_state', 'not_invited')->assertJsonPath('data.phone', null);

    // Guest residents are staff-only; the same person twice is refused.
    $this->actingAs($carlosUser)->postJson('/api/portal/household', ['unit_id' => $unit->id, 'first_name' => 'A', 'last_name' => 'B', 'resident_type' => 'guest_resident'])->assertUnprocessable();
    $this->actingAs($carlosUser)->postJson('/api/portal/household', ['unit_id' => $unit->id, 'first_name' => 'Rosa', 'last_name' => 'Quintana', 'email' => 'rosa@correo.com', 'resident_type' => 'occupant'])
        ->assertUnprocessable()->assertJsonValidationErrors('email');

    // A resident known elsewhere in the account is attached, not recreated.
    $other = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '305']);
    $known = Resident::factory()->for($location->account)->create(['first_name' => 'Pedro', 'last_name' => 'Lau', 'email' => 'pedro@x.pe']);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $other->id, 'resident_id' => $known->id, 'status' => RegistryStatus::Active]);
    $this->actingAs($carlosUser)->postJson('/api/portal/household', ['unit_id' => $unit->id, 'first_name' => 'Pedro', 'last_name' => 'Lau', 'email' => 'pedro@x.pe', 'resident_type' => 'tenant'])
        ->assertCreated()->assertJsonPath('data.resident_id', $known->id);
    expect(Resident::query()->where('email', 'pedro@x.pe')->count())->toBe(1);

    $this->actingAs($carlosUser)->getJson("/api/portal/household?unit_id={$unit->id}")->assertJsonCount(5, 'data');
});

test('the primary contact removes a member and re-sends a pending invitation, never removes themself', function () {
    Notification::fake();
    [$location, $unit, $carlos, $lucia, $carlosUser, $luciaUser] = myUnitWorld();
    $rosa = Resident::factory()->for($location->account)->create(['first_name' => 'Rosa', 'last_name' => 'Quintana', 'email' => 'rosa@x.pe', 'user_id' => null]);
    $rosaMembership = UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $rosa->id, 'status' => RegistryStatus::Active]);
    $luciaMembership = UnitMembership::query()->where('resident_id', $lucia->id)->sole();
    $carlosMembership = UnitMembership::query()->where('resident_id', $carlos->id)->sole();

    // No invitation yet: nothing to resend.
    $this->actingAs($carlosUser)->postJson("/api/portal/household/{$rosaMembership->id}/resend-invitation")->assertUnprocessable();

    UserInvitation::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'resident_id' => $rosa->id, 'email' => 'rosa@x.pe', 'status' => UserInvitationStatus::Pending, 'purpose' => 'resident', 'invited_by_user_id' => $carlosUser->id]);
    $this->actingAs($carlosUser)->postJson("/api/portal/household/{$rosaMembership->id}/resend-invitation")->assertOk()->assertJsonPath('data.portal_state', 'invited');
    Notification::assertSentOnDemand(ResidentInvitationNotification::class);

    $this->actingAs($luciaUser)->deleteJson("/api/portal/household/{$rosaMembership->id}")->assertForbidden();
    $this->actingAs($carlosUser)->deleteJson("/api/portal/household/{$carlosMembership->id}")->assertUnprocessable();
    $this->actingAs($carlosUser)->deleteJson("/api/portal/household/{$luciaMembership->id}")->assertOk()->assertJsonPath('data.status', 'inactive');
    $this->actingAs($carlosUser)->deleteJson("/api/portal/household/{$luciaMembership->id}")->assertUnprocessable();

    expect($luciaMembership->refresh()->ended_at)->not->toBeNull();
    $this->actingAs($carlosUser)->getJson("/api/portal/household?unit_id={$unit->id}")->assertJsonCount(2, 'data');
    // Lucía lost the unit, so she can no longer read it.
    $this->actingAs($luciaUser)->getJson("/api/portal/household?unit_id={$unit->id}")->assertForbidden();
});

test('the ledger is the primary contact\'s: balance, pending scope, refunds negative, voided hidden', function () {
    [$location, $unit, , , $carlosUser, $luciaUser] = myUnitWorld();
    $mk = fn (array $attrs) => FinancialMovement::factory()->for($location)->create([
        'account_id' => $location->account_id, 'unit_id' => $unit->id, 'direction' => MovementDirection::Income, 'category' => MovementCategory::MaintenanceDues, 'concept' => 'Cuota de mantenimiento', ...$attrs,
    ]);
    $mk(['amount' => 250, 'status' => MovementStatus::Pending, 'occurred_on' => '2026-09-01', 'period' => '2026-09']);
    $mk(['amount' => 70, 'status' => MovementStatus::Pending, 'occurred_on' => '2026-09-04', 'category' => MovementCategory::ReservationFee, 'concept' => 'Reserva · Salón de eventos']);
    $mk(['amount' => 250, 'status' => MovementStatus::Paid, 'occurred_on' => '2026-08-01', 'period' => '2026-08']);
    $mk(['amount' => 100, 'status' => MovementStatus::Refunded, 'occurred_on' => '2026-08-18', 'category' => MovementCategory::ReservationDeposit, 'concept' => 'Depósito · Parrilla']);
    $mk(['amount' => 999, 'status' => MovementStatus::Voided, 'occurred_on' => '2026-08-20']);
    FinancialMovement::factory()->for($location)->create(['account_id' => $location->account_id, 'unit_id' => null, 'direction' => MovementDirection::Expense, 'amount' => 500]);

    $this->actingAs($luciaUser)->getJson("/api/portal/ledger?unit_id={$unit->id}")->assertForbidden();

    $all = $this->actingAs($carlosUser)->getJson("/api/portal/ledger?unit_id={$unit->id}")
        ->assertOk()
        ->assertJsonPath('balance', 320)
        ->assertJsonPath('pending_count', 2)
        ->assertJsonPath('last_dues.period', '2026-09')
        ->assertJsonPath('last_dues.amount', 250)
        ->assertJsonPath('last_dues.settled', false)
        ->assertJsonCount(4, 'data')
        ->json('data');
    expect($all[0]['concept'])->toBe('Reserva · Salón de eventos')
        ->and($all[0]['state'])->toBe('pending')
        ->and(collect($all)->firstWhere('concept', 'Depósito devuelto'))->toMatchArray(['amount' => -100, 'state' => 'paid']);

    $this->actingAs($carlosUser)->getJson("/api/portal/ledger?unit_id={$unit->id}&scope=pending")->assertOk()->assertJsonCount(2, 'data');
});

test('a signed-in user changes their password with the current one', function () {
    [, , , , $carlosUser] = myUnitWorld();

    $this->actingAs($carlosUser)->patchJson('/api/me/password', ['current_password' => 'wrong', 'password' => 'new-secret-9', 'password_confirmation' => 'new-secret-9'])
        ->assertUnprocessable()->assertJsonValidationErrors('current_password');
    $this->actingAs($carlosUser)->patchJson('/api/me/password', ['current_password' => 'secret-123', 'password' => 'short', 'password_confirmation' => 'short'])
        ->assertUnprocessable()->assertJsonValidationErrors('password');
    $this->actingAs($carlosUser)->patchJson('/api/me/password', ['current_password' => 'secret-123', 'password' => 'new-secret-9', 'password_confirmation' => 'other'])
        ->assertUnprocessable()->assertJsonValidationErrors('password');
    $this->actingAs($carlosUser)->patchJson('/api/me/password', ['current_password' => 'secret-123', 'password' => 'new-secret-9', 'password_confirmation' => 'new-secret-9'])
        ->assertNoContent();

    expect(Hash::check('new-secret-9', $carlosUser->refresh()->password))->toBeTrue();
});
