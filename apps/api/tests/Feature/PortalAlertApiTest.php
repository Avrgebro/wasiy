<?php

use App\Actions\Reservations\DecideReservation;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ReservationStatus;
use App\Enums\ResidentAlertKind;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Notifications\ResidentAlertNotification;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

/**
 * Two members in 402 with portal access, a neighbour in 305, and a desk user.
 *
 * @return array{Location, Unit, Resident, Resident, User, User, User}
 */
function alertWorld(): array
{
    $location = Location::factory()->create(['timezone' => 'America/Lima', 'name' => 'Edificio Central']);
    $unit = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '402']);
    $carlosUser = User::factory()->create(['email' => 'carlos@x.pe']);
    $carlos = Resident::factory()->for($location->account)->create(['user_id' => $carlosUser->id, 'first_name' => 'Carlos', 'last_name' => 'Mendoza', 'email' => null]);
    $lauraUser = User::factory()->create(['email' => 'laura@x.pe']);
    $laura = Resident::factory()->for($location->account)->create(['user_id' => $lauraUser->id, 'first_name' => 'Laura', 'last_name' => 'Mendoza', 'email' => null]);
    foreach ([$carlos, $laura] as $resident) {
        UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $resident->id, 'status' => RegistryStatus::Active]);
    }
    $desk = User::factory()->create();
    grantLocationRole($location->account, $location, $desk, LocationRole::FrontDesk);

    return [$location, $unit, $carlos, $laura, $carlosUser, $lauraUser, $desk];
}

test('a package for the unit alerts every member in the portal and by email; a named one only its recipient', function () {
    Notification::fake();
    [$location, $unit, $carlos, $laura, $carlosUser, $lauraUser, $desk] = alertWorld();

    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id, 'notes' => 'Caja mediana'])->assertCreated();

    expect(ResidentAlert::query()->where('unit_id', $unit->id)->count())->toBe(2)
        ->and(ResidentAlert::query()->where('resident_id', $carlos->id)->sole()->kind)->toBe(ResidentAlertKind::PackageReceived);
    Notification::assertSentOnDemandTimes(ResidentAlertNotification::class, 2);
    Notification::assertSentOnDemand(ResidentAlertNotification::class, fn (ResidentAlertNotification $n, $channels, $notifiable) => $notifiable->routes['mail'] === 'laura@x.pe' && $n->title === 'Paquete recibido' && $n->locationName === 'Edificio Central');

    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id, 'resident_id' => $laura->id])->assertCreated();

    expect(ResidentAlert::query()->where('resident_id', $laura->id)->count())->toBe(2)
        ->and(ResidentAlert::query()->where('resident_id', $carlos->id)->count())->toBe(1);

    // Carlos lists his alerts for 402 only, newest first; the badge counts them.
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts?unit_id={$unit->id}")
        ->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.kind', 'package.received')
        ->assertJsonPath('data.0.family', 'packages')
        ->assertJsonPath('data.0.subject_type', 'package')
        ->assertJsonPath('data.0.read_at', null);
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts/unread-count?unit_id={$unit->id}")->assertOk()->assertJsonPath('unread', 1);
    $this->actingAs($lauraUser)->getJson("/api/portal/alerts/unread-count?unit_id={$unit->id}")->assertOk()->assertJsonPath('unread', 2);
});

test('marking one and all alerts read is personal, and the list filters with scope=new', function () {
    Notification::fake();
    [$location, $unit, $carlos, $laura, $carlosUser, $lauraUser, $desk] = alertWorld();
    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id])->assertCreated();
    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id])->assertCreated();

    $mine = ResidentAlert::query()->where('resident_id', $carlos->id)->get();
    $hers = ResidentAlert::query()->where('resident_id', $laura->id)->first();

    // Laura cannot mark Carlos's alert.
    $this->actingAs($lauraUser)->postJson("/api/portal/alerts/{$mine[0]->id}/read")->assertForbidden();

    $this->actingAs($carlosUser)->postJson("/api/portal/alerts/{$mine[0]->id}/read")->assertOk()->assertJsonPath('data.id', $mine[0]->id);
    expect($mine[0]->refresh()->read_at)->not->toBeNull();
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts?unit_id={$unit->id}&scope=new")->assertOk()->assertJsonCount(1, 'data');
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts?unit_id={$unit->id}&scope=all")->assertOk()->assertJsonCount(2, 'data');

    $this->actingAs($carlosUser)->postJson('/api/portal/alerts/read-all', ['unit_id' => $unit->id])->assertOk()->assertJsonPath('marked', 1);
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts/unread-count?unit_id={$unit->id}")->assertJsonPath('unread', 0);
    expect($hers->refresh()->read_at)->toBeNull();

    // A neighbour from another unit sees nothing here.
    $other = Unit::factory()->for($location->account)->for($location)->create(['unit_number' => '305']);
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts?unit_id={$other->id}")->assertForbidden();
    $this->actingAs($desk)->getJson("/api/portal/alerts?unit_id={$unit->id}")->assertForbidden();
});

test('email switches are per family and default on; a switched-off family stays in the portal but leaves the inbox', function () {
    Notification::fake();
    [$location, $unit, $carlos, , $carlosUser, , $desk] = alertWorld();

    $this->actingAs($carlosUser)->getJson('/api/portal/resident')
        ->assertOk()
        ->assertJsonPath('data.email_alerts', ['reservations' => true, 'packages' => true, 'visitors' => true, 'announcements' => true])
        ->assertJsonPath('data.login_email', 'carlos@x.pe');

    $this->actingAs($carlosUser)->patchJson('/api/portal/resident/email-alerts', ['reservations' => true, 'packages' => false, 'visitors' => true])
        ->assertUnprocessable()->assertJsonValidationErrors('announcements');
    $this->actingAs($carlosUser)->patchJson('/api/portal/resident/email-alerts', ['reservations' => true, 'packages' => false, 'visitors' => true, 'announcements' => true])
        ->assertOk()->assertJsonPath('data.email_alerts.packages', false);

    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/packages", ['unit_id' => $unit->id])->assertCreated();

    expect(ResidentAlert::query()->where('resident_id', $carlos->id)->count())->toBe(1);
    Notification::assertSentOnDemandTimes(ResidentAlertNotification::class, 1);
    Notification::assertSentOnDemand(ResidentAlertNotification::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'laura@x.pe');

    $this->actingAs($desk)->patchJson('/api/portal/resident/email-alerts', ['reservations' => true, 'packages' => true, 'visitors' => true, 'announcements' => true])->assertForbidden();
});

test('reservation decisions and visitor arrivals alert the unit with a portal link', function () {
    Notification::fake();
    [$location, $unit, $carlos, , $carlosUser, , $desk] = alertWorld();
    config()->set('wasiy.portal.url', 'https://portal.wasiy.test/');
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $location->account_id, 'name' => 'Salón de eventos',
        'availability' => ['monday' => [['start' => '09:00', 'end' => '21:00']]],
    ]);
    $monday = CarbonImmutable::now('America/Lima')->addWeek()->next('Monday');
    $reservation = Reservation::factory()->create([
        'account_id' => $location->account_id, 'location_id' => $location->id, 'amenity_id' => $amenity->id, 'unit_id' => $unit->id, 'resident_id' => $carlos->id,
        'status' => ReservationStatus::Pending,
        'starts_at' => $monday->setTime(15, 0)->utc(), 'ends_at' => $monday->setTime(17, 0)->utc(),
    ]);
    $manager = User::factory()->create();
    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);

    app(DecideReservation::class)->observe($reservation, $manager, 'Falta el pago del depósito.');
    app(DecideReservation::class)->approve($reservation->refresh(), $manager);

    $kinds = ResidentAlert::query()->where('resident_id', $carlos->id)->orderBy('created_at')->orderBy('id')->pluck('kind')->map(fn ($kind) => $kind->value)->all();
    expect($kinds)->toBe(['reservation.observed', 'reservation.approved']);
    Notification::assertSentOnDemand(ResidentAlertNotification::class, fn (ResidentAlertNotification $n) => $n->title === 'Tu reserva fue aprobada'
        && $n->actionUrl === 'https://portal.wasiy.test/portal/reservas'
        && $n->actionLabel === 'Ver reserva'
        && collect($n->facts)->pluck('label')->contains('Amenidad'));
    Notification::assertSentOnDemand(ResidentAlertNotification::class, fn (ResidentAlertNotification $n) => $n->title === 'Tu reserva fue observada' && str_contains($n->body ?? '', 'Falta el pago'));

    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/visits", ['unit_id' => $unit->id, 'visitor_name' => 'Jorge Peña'])->assertCreated();
    $this->actingAs($carlosUser)->getJson("/api/portal/alerts?unit_id={$unit->id}")
        ->assertOk()->assertJsonPath('data.0.kind', 'visit.arrived')->assertJsonPath('data.0.title', 'Visitante llegó')->assertJsonPath('data.0.subject_type', 'visit');
});

test('alerts:prune drops read alerts past the retention window and keeps unread ones', function () {
    [$location, $unit, $carlos] = alertWorld();
    $base = ['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $carlos->id];
    $oldRead = ResidentAlert::factory()->read()->create($base);
    $oldUnread = ResidentAlert::factory()->create($base);
    ResidentAlert::query()->whereKey([$oldRead->id, $oldUnread->id])->update(['created_at' => now()->subDays(120)]);
    $fresh = ResidentAlert::factory()->read()->create($base);

    $this->artisan('alerts:prune')->assertSuccessful();

    expect(ResidentAlert::query()->pluck('id')->sort()->values()->all())->toBe(collect([$oldUnread->id, $fresh->id])->sort()->values()->all());
});
