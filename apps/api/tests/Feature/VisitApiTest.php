<?php

use App\Enums\ActivityEventType;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, Unit, User}
 */
function visitWorld(int $autoCheckoutHours = 0): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    if ($autoCheckoutHours > 0) {
        $location->forceFill(['settings' => ['visitor_auto_checkout_hours' => $autoCheckoutHours]])->save();
    }
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '402', 'building_name' => 'Torre A']);
    $desk = User::factory()->create();
    createStaffMembership($account, $desk);
    grantLocationRole($account, $location, $desk, LocationRole::FrontDesk);

    return [$account, $location, $unit, $desk];
}

function hostOf(Unit $unit, array $resident = []): Resident
{
    $person = Resident::factory()->create(['account_id' => $unit->account_id, ...$resident]);
    UnitMembership::factory()->create([
        'account_id' => $unit->account_id, 'location_id' => $unit->location_id, 'unit_id' => $unit->id, 'resident_id' => $person->id,
        'status' => RegistryStatus::Active, 'is_primary_contact' => true,
    ]);

    return $person;
}

test('front desk registers a walk-in with an optional host and confirmation, and it is logged', function () {
    [$account, $location, $unit, $desk] = visitWorld();
    $carlos = hostOf($unit, ['first_name' => 'Carlos', 'last_name' => 'Mendoza', 'phone' => '+51 987 654 321', 'email' => 'c@x.pe']);

    $response = $this->actingAs($desk)
        ->postJson("/api/locations/{$location->id}/visits", [
            'visitor_name' => 'Elena Vargas', 'unit_id' => $unit->id, 'resident_id' => $carlos->id,
            'document' => 'DNI 45872213', 'confirmation' => 'intercom', 'notes' => 'Madre del residente',
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'inside')
        ->assertJsonPath('data.unit_number', '402')
        ->assertJsonPath('data.resident_name', 'Carlos Mendoza')
        ->assertJsonPath('data.resident_phone', '+51 987 654 321')
        ->assertJsonMissingPath('data.resident_email')
        ->assertJsonPath('data.confirmation', 'intercom')
        ->assertJsonPath('data.checked_in_by_name', $desk->name);

    expect(ActivityLog::query()->where('event_type', ActivityEventType::VisitCheckedIn->value)->where('subject_id', $response->json('data.id'))->exists())->toBeTrue();

    // Confirmation defaults to none; unit must be in the location; host must live there.
    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/visits", ['visitor_name' => 'Delivery Rappi', 'unit_id' => $unit->id])
        ->assertCreated()->assertJsonPath('data.confirmation', 'none')->assertJsonPath('data.resident_id', null);
    $other = Unit::factory()->create(['account_id' => $account->id, 'location_id' => Location::factory()->for($account)->create()->id]);
    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/visits", ['visitor_name' => 'X', 'unit_id' => $other->id])
        ->assertUnprocessable()->assertJsonValidationErrors('unit_id');
    $stranger = Resident::factory()->create(['account_id' => $account->id]);
    $this->actingAs($desk)->postJson("/api/locations/{$location->id}/visits", ['visitor_name' => 'X', 'unit_id' => $unit->id, 'resident_id' => $stranger->id])
        ->assertUnprocessable()->assertJsonValidationErrors('resident_id');
});

test('check-out is one way and keeps its notes', function () {
    [$account, $location, $unit, $desk] = visitWorld();
    $visit = Visit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'checked_in_by' => $desk->id]);

    $this->actingAs($desk)
        ->postJson("/api/visits/{$visit->id}/check-out", ['notes' => 'Se retira con paquete'])
        ->assertOk()
        ->assertJsonPath('data.status', 'left')
        ->assertJsonPath('data.checkout_notes', 'Se retira con paquete')
        ->assertJsonPath('data.auto_checked_out', false)
        ->assertJsonPath('data.checked_out_by_name', $desk->name);

    $this->actingAs($desk)->postJson("/api/visits/{$visit->id}/check-out")->assertUnprocessable()->assertJsonValidationErrors('status');

    $outsider = User::factory()->create();
    $this->actingAs($outsider)->getJson("/api/locations/{$location->id}/visits")->assertForbidden();
});

test('the list filters inside and today, and searches visitor, document, unit and host', function () {
    [$account, $location, $unit, $desk] = visitWorld();
    $carlos = hostOf($unit, ['first_name' => 'Carlos', 'last_name' => 'Mendoza']);
    $other = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_number' => '609', 'building_name' => 'Torre B']);
    $base = fn (array $o) => Visit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'checked_in_by' => $desk->id, ...$o]);

    $base(['unit_id' => $unit->id, 'resident_id' => $carlos->id, 'visitor_name' => 'Elena Vargas', 'document' => 'DNI 45872213', 'checked_in_at' => now()->subHour()]);
    $base(['unit_id' => $other->id, 'visitor_name' => 'Delivery Rappi', 'checked_in_at' => now()->subMinutes(5)]);
    $base(['unit_id' => $other->id, 'visitor_name' => 'Técnico Gas', 'status' => 'left', 'checked_out_at' => now()->subDays(1), 'checked_in_at' => now()->subDays(2)]);

    $url = "/api/locations/{$location->id}/visits";
    $names = fn (string $q = '') => collect($this->actingAs($desk)->getJson($url.$q)->assertOk()->json('data'))->pluck('visitor_name')->all();

    expect($names())->toBe(['Delivery Rappi', 'Elena Vargas', 'Técnico Gas'])
        ->and($names('?status=inside'))->toBe(['Delivery Rappi', 'Elena Vargas'])
        ->and($names('?today=1'))->toBe(['Delivery Rappi', 'Elena Vargas'])
        ->and($names('?search=45872213'))->toBe(['Elena Vargas'])
        ->and($names('?search=mendoza'))->toBe(['Elena Vargas'])
        ->and($names('?search=torre b'))->toBe(['Delivery Rappi', 'Técnico Gas']);

    $this->actingAs($desk)->getJson("/api/units/{$other->id}")->assertOk()->assertJsonCount(2, 'visits')->assertJsonPath('visits.0.visitor_name', 'Delivery Rappi');
});

test('the scheduled command closes visits past the location setting and leaves the rest', function () {
    [$account, $location, $unit, $desk] = visitWorld(autoCheckoutHours: 8);
    [$account2, $location2, $unit2, $desk2] = visitWorld(); // 0 = never
    $mk = fn (Unit $u, User $d, int $hoursAgo) => Visit::factory()->create(['account_id' => $u->account_id, 'location_id' => $u->location_id, 'unit_id' => $u->id, 'checked_in_by' => $d->id, 'checked_in_at' => now()->subHours($hoursAgo)]);

    $old = $mk($unit, $desk, 9);
    $fresh = $mk($unit, $desk, 2);
    $never = $mk($unit2, $desk2, 30);

    $this->artisan('visits:auto-check-out')->expectsOutputToContain('Closed 1 visit(s)')->assertSuccessful();

    expect($old->fresh()->status->value)->toBe('left')
        ->and($old->fresh()->auto_checked_out)->toBeTrue()
        ->and($old->fresh()->checked_out_by)->toBeNull()
        ->and($fresh->fresh()->status->value)->toBe('inside')
        ->and($never->fresh()->status->value)->toBe('inside');

    $log = ActivityLog::query()->where('event_type', ActivityEventType::VisitCheckedOut->value)->where('subject_id', $old->id)->sole();
    expect($log->metadata['automatic'])->toBeTrue()->and($log->actor_user_id)->toBeNull();
});
