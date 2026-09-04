<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\BookingMode;
use App\Enums\LocationRole;
use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, User}
 */
function unitWorld(): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return [$account, $location, $admin];
}

function homeUnit(Location $location, array $attributes = []): Unit
{
    return Unit::factory()->create([
        'account_id' => $location->account_id,
        'location_id' => $location->id,
        'unit_number' => '402',
        'building_name' => 'Torre A',
        'floor' => '4',
        'type' => 'apartment',
        'area_m2' => 118,
        'participation_share' => 1.18,
        'maintenance_fee' => 420,
        'parking_spots' => 'E-23',
        'storage_rooms' => 'D-04',
        ...$attributes,
    ]);
}

function liveIn(Unit $unit, array $resident = [], array $membership = []): UnitMembership
{
    $person = Resident::factory()->create(['account_id' => $unit->account_id, ...$resident]);

    return UnitMembership::factory()->create([
        'account_id' => $unit->account_id,
        'location_id' => $unit->location_id,
        'unit_id' => $unit->id,
        'resident_id' => $person->id,
        'resident_type' => ResidentType::Owner,
        'status' => RegistryStatus::Active,
        'is_primary_contact' => false,
        ...$membership,
    ]);
}

test('a unit is created and updated with the condo fields', function () {
    [$account, $location, $admin] = unitWorld();

    $id = $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/units", [
            'unit_number' => '501', 'type' => 'apartment', 'building_name' => 'Torre A', 'floor' => '5',
            'area_m2' => 142.5, 'participation_share' => 1.42, 'maintenance_fee' => 520,
            'parking_spots' => 'E-12, E-13', 'storage_rooms' => 'D-04',
        ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'apartment')
        ->assertJsonPath('data.area_m2', 142.5)
        ->assertJsonPath('data.participation_share', 1.42)
        ->assertJsonPath('data.maintenance_fee', 520)
        ->assertJsonPath('data.parking_spots', ['E-12', 'E-13'])
        ->assertJsonPath('data.storage_rooms', ['D-04'])
        ->assertJsonPath('data.occupancy', 'vacant')
        ->assertJsonPath('data.portal_state', null)
        ->json('data.id');

    $this->actingAs($admin)
        ->patchJson("/api/units/{$id}", ['maintenance_fee' => null, 'type' => 'commercial'])
        ->assertOk()
        ->assertJsonPath('data.maintenance_fee', null)
        ->assertJsonPath('data.type', 'commercial');

    $this->actingAs($admin)
        ->postJson("/api/locations/{$location->id}/units", ['unit_number' => '502', 'type' => 'parking'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('type');
});

test('occupancy and portal state are derived and filterable, and search reaches residents and plates', function () {
    [$account, $location, $admin] = unitWorld();

    $occupied = homeUnit($location);
    liveIn($occupied, ['first_name' => 'Carlos', 'last_name' => 'Mendoza', 'user_id' => User::factory()->create()->id], ['is_primary_contact' => true]);
    Vehicle::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $occupied->id, 'plate' => 'AXB-241']);

    $attention = homeUnit($location, ['unit_number' => '305', 'building_name' => 'Torre B', 'maintenance_fee' => null]);
    liveIn($attention, ['first_name' => 'Sofía', 'last_name' => 'Gutiérrez']);

    $vacant = homeUnit($location, ['unit_number' => '609', 'building_name' => 'Torre B']);

    $base = "/api/locations/{$location->id}/units";
    $numbers = fn (string $query): array => collect($this->actingAs($admin)->getJson("{$base}?{$query}")->assertOk()->json('data'))->pluck('unit_number')->sort()->values()->all();

    expect($numbers('occupancy=occupied'))->toBe(['305', '402'])
        ->and($numbers('occupancy=attention'))->toBe(['305'])
        ->and($numbers('occupancy=vacant'))->toBe(['609'])
        ->and($numbers('portal=active'))->toBe(['402'])
        ->and($numbers('portal=none'))->toBe(['305'])
        ->and($numbers('fee=missing'))->toBe(['305'])
        ->and($numbers('search=mendoza'))->toBe(['402'])
        ->and($numbers('search=axb'))->toBe(['402'])
        ->and($numbers('search=torre b'))->toBe(['305', '609']);

    $row = collect($this->actingAs($admin)->getJson($base)->json('data'))->firstWhere('unit_number', '402');
    expect($row['occupancy'])->toBe('occupied')->and($row['portal_state'])->toBe('active')->and($row['vehicle_count'])->toBe(1);
    $row = collect($this->actingAs($admin)->getJson($base)->json('data'))->firstWhere('unit_number', '305');
    expect($row['occupancy'])->toBe('attention')->and($row['portal_state'])->toBe('not_invited');
});

test('show returns members, vehicles, upcoming reservations, this month charges, balance and notes', function () {
    [$account, $location, $admin] = unitWorld();
    $unit = homeUnit($location);
    liveIn($unit, ['first_name' => 'Carlos', 'last_name' => 'Mendoza', 'phone' => '+51 987 654 321'], ['is_primary_contact' => true]);
    liveIn($unit, ['first_name' => 'Laura', 'last_name' => 'Mendoza'], ['resident_type' => ResidentType::Tenant]);
    Vehicle::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'plate' => 'AXB-241']);

    $amenity = Amenity::factory()->for($location)->create(['account_id' => $account->id, 'booking_mode' => BookingMode::Instant]);
    Reservation::factory()->create([
        'account_id' => $account->id, 'location_id' => $location->id, 'amenity_id' => $amenity->id, 'unit_id' => $unit->id,
        'starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(2)->addHour(), 'created_by' => $admin->id,
    ]);

    $month = CarbonImmutable::now('America/Lima')->format('Y-m');
    FinancialMovement::factory()->income()->for($location)->create([
        'account_id' => $account->id, 'created_by' => $admin->id, 'unit_id' => $unit->id,
        'category' => 'maintenance_dues', 'status' => 'paid', 'amount' => 420, 'occurred_on' => "{$month}-01",
    ]);
    FinancialMovement::factory()->income()->for($location)->create([
        'account_id' => $account->id, 'created_by' => $admin->id, 'unit_id' => $unit->id,
        'category' => 'fine', 'status' => 'pending', 'amount' => 80, 'occurred_on' => "{$month}-11",
    ]);

    $this->actingAs($admin)
        ->postJson("/api/units/{$unit->id}/notes", ['body' => 'Autorizan visitas recurrentes de la Sra. Vargas.'])
        ->assertCreated()
        ->assertJsonPath('data.author_name', $admin->name);

    $this->actingAs($admin)
        ->getJson("/api/units/{$unit->id}")
        ->assertOk()
        ->assertJsonPath('data.occupancy', 'occupied')
        ->assertJsonCount(2, 'data.members')
        ->assertJsonPath('data.members.0.is_primary_contact', true)
        ->assertJsonPath('data.members.0.name', 'Carlos Mendoza')
        ->assertJsonPath('data.members.0.phone', '+51 987 654 321')
        ->assertJsonPath('data.members.0.portal_state', 'not_invited')
        ->assertJsonPath('data.members.1.resident_type', 'tenant')
        ->assertJsonCount(1, 'data.vehicles')
        ->assertJsonPath('data.vehicles.0.plate', 'AXB-241')
        ->assertJsonCount(1, 'reservations')
        ->assertJsonCount(2, 'movements')
        ->assertJsonPath('movements_month', $month)
        ->assertJsonPath('pending_balance', 80)
        ->assertJsonCount(1, 'notes')
        ->assertJsonPath('notes.0.body', 'Autorizan visitas recurrentes de la Sra. Vargas.');

    $frontDesk = User::factory()->create();
    createStaffMembership($account, $frontDesk);
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);
    $this->actingAs($frontDesk)->getJson("/api/units/{$unit->id}")->assertOk();
    $this->actingAs($frontDesk)->postJson("/api/units/{$unit->id}/notes", ['body' => 'x'])->assertForbidden();
});

test('deactivating a unit ends memberships, parks vehicles and cancels future bookings; reactivation restores the unit only', function () {
    [$account, $location, $admin] = unitWorld();
    $unit = homeUnit($location);
    liveIn($unit, [], ['is_primary_contact' => true]);
    liveIn($unit);
    $vehicle = Vehicle::factory()->create(['account_id' => $account->id, 'location_id' => $location->id, 'unit_id' => $unit->id]);

    $amenity = Amenity::factory()->for($location)->create(['account_id' => $account->id, 'availability' => ['monday' => [['start' => '09:00', 'end' => '22:00']]], 'fee_amount' => 50]);
    $monday = CarbonImmutable::now('America/Lima')->addWeek()->next('Monday');
    $future = Reservation::factory()->create([
        'account_id' => $account->id, 'location_id' => $location->id, 'amenity_id' => $amenity->id, 'unit_id' => $unit->id,
        'starts_at' => $monday->setTime(10, 0)->utc(), 'ends_at' => $monday->setTime(12, 0)->utc(), 'fee_snapshot' => 50, 'created_by' => $admin->id,
    ]);
    $past = Reservation::factory()->create([
        'account_id' => $account->id, 'location_id' => $location->id, 'amenity_id' => $amenity->id, 'unit_id' => $unit->id,
        'starts_at' => now()->subDays(3), 'ends_at' => now()->subDays(3)->addHour(), 'created_by' => $admin->id,
    ]);
    // A pending charge on the future booking should be voided by the cascade.
    $fee = FinancialMovement::factory()->income()->for($location)->create([
        'account_id' => $account->id, 'created_by' => $admin->id, 'unit_id' => $unit->id, 'reservation_id' => $future->id,
        'category' => 'reservation_fee', 'status' => 'pending', 'amount' => 50,
    ]);

    $this->actingAs($admin)
        ->postJson("/api/units/{$unit->id}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'inactive')
        ->assertJsonPath('data.resident_count', 0);

    expect(UnitMembership::query()->where('unit_id', $unit->id)->where('status', 'active')->count())->toBe(0)
        ->and(UnitMembership::query()->where('unit_id', $unit->id)->where('is_primary_contact', true)->count())->toBe(0)
        ->and($vehicle->fresh()->status)->toBe(RegistryStatus::Inactive)
        ->and($future->fresh()->status->value)->toBe('cancelled')
        ->and($past->fresh()->status->value)->toBe('approved')
        ->and($fee->fresh()->status->value)->toBe('voided');

    $log = ActivityLog::query()->where('event_type', ActivityEventType::UnitInactivated->value)->where('subject_id', $unit->id)->latest('id')->firstOrFail();
    expect($log->metadata)->toMatchArray(['memberships_ended' => 2, 'vehicles_inactivated' => 1, 'reservations_cancelled' => 1]);

    $this->actingAs($admin)
        ->postJson("/api/units/{$unit->id}/reactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.resident_count', 0);
});

test('monthly dues are generated once per unit and month', function () {
    [$account, $location, $admin] = unitWorld();
    homeUnit($location, ['unit_number' => '402', 'maintenance_fee' => 420]);
    homeUnit($location, ['unit_number' => '118', 'maintenance_fee' => 380]);
    homeUnit($location, ['unit_number' => '609', 'maintenance_fee' => null]);
    homeUnit($location, ['unit_number' => '999', 'maintenance_fee' => 300, 'status' => RegistryStatus::Inactive]);

    $url = "/api/accounts/{$account->id}/locations/{$location->id}/finances/dues";

    $this->actingAs($admin)->postJson($url, ['month' => '2026-08'])
        ->assertOk()->assertJson(['data' => ['created' => 2, 'skipped' => 0]]);

    $dues = FinancialMovement::query()->where('category', 'maintenance_dues')->where('period', '2026-08')->get();
    expect($dues)->toHaveCount(2)
        ->and($dues->sum('amount'))->toBe(800)
        ->and($dues->first()->status->value)->toBe('pending')
        ->and($dues->first()->occurred_on->toDateString())->toBe('2026-08-01')
        ->and($dues->first()->concept)->toBe('Cuota de mantenimiento · agosto 2026')
        ->and($dues->first()->detail)->toStartWith('Emitida el 01 ago');

    // Second run: nothing new. A unit that gains a fee later fills its gap.
    $this->actingAs($admin)->postJson($url, ['month' => '2026-08'])
        ->assertOk()->assertJson(['data' => ['created' => 0, 'skipped' => 2]]);
    Unit::query()->where('unit_number', '609')->update(['maintenance_fee' => 250]);
    $this->actingAs($admin)->postJson($url, ['month' => '2026-08'])
        ->assertOk()->assertJson(['data' => ['created' => 1, 'skipped' => 2]]);

    // The list filters by unit and the summary counts the dues as receivable.
    $unit = Unit::query()->where('unit_number', '402')->firstOrFail();
    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}/finances/movements?month=2026-08&unit_id={$unit->id}")
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.period', '2026-08');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::DuesGenerated->value)->count())->toBe(3);

    $this->actingAs($admin)->postJson($url, ['month' => 'agosto'])->assertUnprocessable();
});
