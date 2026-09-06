<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Announcement;
use App\Models\Location;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Notifications\ResidentAlertNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, User, User}
 */
function announcementWorld(): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    return [$account, $location, $admin, $manager];
}

function housedIn(Location $location, array $resident = [], bool $withUser = false): Resident
{
    $unit = Unit::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id]);
    $person = Resident::factory()->create([
        'account_id' => $location->account_id,
        'user_id' => $withUser ? User::factory()->create()->id : null,
        ...$resident,
    ]);
    UnitMembership::factory()->create([
        'account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $person->id,
        'status' => RegistryStatus::Active, 'is_primary_contact' => true,
    ]);

    return $person;
}

test('publishing now alerts every active resident of the location and records the counts', function () {
    Notification::fake();
    [$account, $location, $admin, $manager] = announcementWorld();
    housedIn($location, ['first_name' => 'Carlos', 'email' => 'carlos@x.pe'], withUser: true);
    housedIn($location, ['first_name' => 'Lucía', 'email' => 'lucia@x.pe']);
    housedIn($location, ['first_name' => 'Ex', 'status' => RegistryStatus::Inactive]);
    $elsewhere = Location::factory()->for($account)->create();
    housedIn($elsewhere, ['first_name' => 'Otro'], withUser: true);

    $body = "El **martes 9** cortaremos el agua de 09:00 a 13:00.\n\nDurante esas horas no habrá servicio.\n\n- Almacenen agua\n- No usen lavadoras";
    $response = $this->actingAs($manager)
        ->postJson("/api/locations/{$location->id}/announcements", ['title' => 'Corte de agua programado', 'body_md' => $body, 'is_important' => true, 'expires_on' => now($location->timezone)->addDays(3)->toDateString()])
        ->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.is_important', true)
        ->assertJsonPath('data.excerpt', 'El martes 9 cortaremos el agua de 09:00 a 13:00.')
        ->assertJsonPath('data.author_name', $manager->name)
        ->assertJsonPath('data.notified_count', 2)
        ->assertJsonPath('data.emailed_count', 0);

    expect($response->json('data.body_html'))->toContain('<strong>martes 9</strong>')->toContain('<li>Almacenen agua</li>');
    // One portal row per resident with a login; nobody from the other location.
    expect(ResidentAlert::query()->where('subject_id', $response->json('data.id'))->count())->toBe(1);
    // The location's email switch is off by default.
    Notification::assertNothingSent();
    expect(ActivityLog::query()->where('event_type', ActivityEventType::AnnouncementPublished->value)->where('subject_id', $response->json('data.id'))->exists())->toBeTrue();
});

test('the location email switch sends the branded mail to residents with an address', function () {
    Notification::fake();
    [$account, $location, $admin] = announcementWorld();
    $location->forceFill(['settings' => ['announcements_email_residents' => true]])->save();
    housedIn($location, ['email' => 'carlos@x.pe'], withUser: true);
    housedIn($location, ['email' => null]);

    $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/announcements", ['title' => 'Aviso', 'body_md' => 'Texto.'])
        ->assertCreated()
        ->assertJsonPath('data.notified_count', 2)
        ->assertJsonPath('data.emailed_count', 1);
    Notification::assertSentOnDemand(ResidentAlertNotification::class);
    Notification::assertCount(1);
});

test('a future publish time schedules the post; the command publishes it when due', function () {
    Notification::fake();
    [$account, $location, $admin] = announcementWorld();
    housedIn($location, [], withUser: true);
    $this->travelTo(Carbon::parse('2026-09-05 15:00:00', 'UTC'));

    $response = $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/announcements", ['title' => 'Fumigación', 'body_md' => 'Lunes 8.', 'publish_at' => '2026-09-08 08:00'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.publish_at', '2026-09-08T13:00:00.000000Z')
        ->assertJsonPath('data.published_at', null);
    expect(ResidentAlert::query()->count())->toBe(0)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::AnnouncementScheduled->value)->exists())->toBeTrue();

    $this->artisan('announcements:publish-due')->expectsOutputToContain('Published 0');
    $this->travelTo(Carbon::parse('2026-09-08 13:00:30', 'UTC'));
    $this->artisan('announcements:publish-due')->expectsOutputToContain('Published 1');

    $this->actingAs($admin)->getJson("/api/announcements/{$response->json('data.id')}")
        ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.notified_count', 1);
    expect(ResidentAlert::query()->count())->toBe(1);
});

test('the list derives status in the location day and filters and searches', function () {
    [$account, $location, $admin] = announcementWorld();
    $this->travelTo(Carbon::parse('2026-09-05 15:00:00', 'UTC'));
    $make = fn (array $attributes) => Announcement::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'author_user_id' => $admin->id, ...$attributes]);
    $make(['title' => 'Vigente sin fin']);
    $make(['title' => 'Vigente hasta hoy', 'expires_on' => '2026-09-05']);
    $make(['title' => 'Vencido ayer', 'expires_on' => '2026-09-04']);
    $make(['title' => 'Programado', 'publish_at' => now()->addDay(), 'published_at' => null]);
    $make(['title' => 'Archivado', 'archived_at' => now()]);

    $titles = fn (string $query = '') => collect($this->actingAs($admin)->getJson("/api/locations/{$location->id}/announcements{$query}")->assertOk()->json('data'))->pluck('title')->sort()->values()->all();

    expect($titles())->toBe(['Archivado', 'Programado', 'Vencido ayer', 'Vigente hasta hoy', 'Vigente sin fin'])
        ->and($titles('?status=active'))->toBe(['Vigente hasta hoy', 'Vigente sin fin'])
        ->and($titles('?status=scheduled'))->toBe(['Programado'])
        ->and($titles('?status=expired'))->toBe(['Vencido ayer'])
        ->and($titles('?status=archived'))->toBe(['Archivado'])
        ->and($titles('?search=vencido'))->toBe(['Vencido ayer']);

    $row = collect($this->actingAs($admin)->getJson("/api/locations/{$location->id}/announcements")->json('data'))->firstWhere('title', 'Vencido ayer');
    expect($row['status'])->toBe('expired');
});

test('edits never re-notify, a live post keeps its publication time, and archiving pulls it', function () {
    Notification::fake();
    [$account, $location, $admin] = announcementWorld();
    $location->forceFill(['settings' => ['announcements_email_residents' => true]])->save();
    housedIn($location, ['email' => 'carlos@x.pe'], withUser: true);

    $id = $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/announcements", ['title' => 'Aviso', 'body_md' => 'Primera versión.'])
        ->assertCreated()->json('data.id');
    Notification::assertCount(1);

    $this->actingAs($admin)->patchJson("/api/announcements/{$id}", ['title' => 'Aviso corregido', 'body_md' => "Segunda versión.\n\nMás detalle.", 'is_important' => true])
        ->assertOk()
        ->assertJsonPath('data.title', 'Aviso corregido')
        ->assertJsonPath('data.excerpt', 'Segunda versión.')
        ->assertJsonPath('data.is_important', true);
    Notification::assertCount(1);
    expect(ResidentAlert::query()->count())->toBe(1)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::AnnouncementUpdated->value)->exists())->toBeTrue();

    $this->actingAs($admin)->patchJson("/api/announcements/{$id}", ['publish_at' => '2030-01-01 08:00'])
        ->assertUnprocessable()->assertJsonValidationErrors('publish_at');
    $this->actingAs($admin)->patchJson("/api/announcements/{$id}", ['expires_on' => '2020-01-01'])
        ->assertUnprocessable()->assertJsonValidationErrors('expires_on');

    $this->actingAs($admin)->postJson("/api/announcements/{$id}/archive")->assertOk()->assertJsonPath('data.status', 'archived');
    $this->actingAs($admin)->patchJson("/api/announcements/{$id}", ['title' => 'Otra'])->assertUnprocessable()->assertJsonValidationErrors('status');
    expect(ActivityLog::query()->where('event_type', ActivityEventType::AnnouncementArchived->value)->exists())->toBeTrue();
});

test('managers post only while the location allows it; the desk and outsiders never do', function () {
    [$account, $location, $admin, $manager] = announcementWorld();
    $desk = User::factory()->create();
    grantLocationRole($account, $location, $desk, LocationRole::FrontDesk);
    $payload = ['title' => 'Aviso', 'body_md' => 'Texto.'];

    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/announcements", $payload)->assertCreated();

    $location->forceFill(['settings' => ['announcements_location_manager_can_post' => false]])->save();
    $this->actingAs($manager)->postJson("/api/locations/{$location->id}/announcements", $payload)->assertForbidden();
    $this->actingAs($manager)->getJson("/api/locations/{$location->id}/announcements")->assertOk();
    $this->actingAs($admin)->postJson("/api/locations/{$location->id}/announcements", $payload)->assertCreated();

    $this->actingAs($desk)->getJson("/api/locations/{$location->id}/announcements")->assertForbidden();
    $this->actingAs(User::factory()->create())->getJson("/api/locations/{$location->id}/announcements")->assertForbidden();
});

test('raw html in the body is stripped and links stay safe', function () {
    [$account, $location, $admin] = announcementWorld();

    $response = $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/announcements", ['title' => 'Aviso', 'body_md' => "Hola <script>alert(1)</script> [anexo](javascript:alert(1)) y [web](https://wasiy.co).\n\nSegundo."])
        ->assertCreated();

    expect($response->json('data.body_html'))->not->toContain('<script')->not->toContain('javascript:')->toContain('href="https://wasiy.co"')
        ->and($response->json('data.excerpt'))->toBe('Hola alert(1) anexo y web.');
});
