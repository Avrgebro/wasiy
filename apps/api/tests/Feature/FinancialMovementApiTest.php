<?php

use App\Actions\Finances\SyncReservationMovements;
use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\BookingMode;
use App\Enums\LocationRole;
use App\Enums\MovementStatus;
use App\Enums\ReservationStatus;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array{Account, Location, Unit, User}
 */
function financeWorld(): array
{
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create(['timezone' => 'America/Lima']);
    $unit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $location->id]);

    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return [$account, $location, $unit, $admin];
}

function movementsBase(Account $account, Location $location): string
{
    return "/api/accounts/{$account->id}/locations/{$location->id}/finances/movements";
}

function statusUrl(Account $account, FinancialMovement $movement): string
{
    return "/api/accounts/{$account->id}/finances/movements/{$movement->id}/status";
}

function expensePayload(array $overrides = []): array
{
    return [
        'direction' => 'expense',
        'category' => 'water',
        'amount' => 600,
        'concept' => 'Agua · áreas comunes',
        'detail' => 'Recibo Sedapal · vence 20 ago',
        'counterparty' => 'Sedapal',
        'occurred_on' => '2026-08-16',
        'due_on' => '2026-08-20',
        ...$overrides,
    ];
}

function seedMovement(Location $location, User $actor, array $attributes = []): FinancialMovement
{
    return FinancialMovement::factory()->for($location)->create([
        'account_id' => $location->account_id,
        'created_by' => $actor->id,
        ...$attributes,
    ]);
}

/**
 * A pending approval-mode reservation with fee and deposit snapshots on a
 * Monday slot inside the amenity's window.
 *
 * @return array{Amenity, Reservation}
 */
function pendingReservationWithCharges(Account $account, Location $location, Unit $unit, User $creator, string $mode = 'approval'): array
{
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $account->id,
        'name' => 'Salón de eventos',
        'booking_mode' => BookingMode::from($mode),
        'availability' => ['monday' => [['start' => '09:00', 'end' => '22:00']]],
        'fee_amount' => 150,
        'deposit_amount' => 300,
    ]);
    $monday = CarbonImmutable::now('America/Lima')->addWeek()->next('Monday');
    $reservation = Reservation::factory()->pending()->create([
        'account_id' => $account->id,
        'location_id' => $location->id,
        'amenity_id' => $amenity->id,
        'unit_id' => $unit->id,
        'starts_at' => $monday->setTime(10, 0)->utc(),
        'ends_at' => $monday->setTime(12, 0)->utc(),
        'fee_snapshot' => 150,
        'deposit_snapshot' => 300,
        'created_by' => $creator->id,
    ]);

    return [$amenity, $reservation];
}

test('a manager records an expense as pending with an activity entry', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $response = $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload())
        ->assertCreated()
        ->assertJsonPath('data.direction', 'expense')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.amount', 600)
        ->assertJsonPath('data.counterparty', 'Sedapal')
        ->assertJsonPath('data.occurred_on', '2026-08-16')
        ->assertJsonPath('data.allowed_transitions', ['paid', 'voided'])
        ->assertJsonPath('data.settled_by', null);

    expect(ActivityLog::query()
        ->where('event_type', ActivityEventType::MovementRecorded->value)
        ->where('subject_id', $response->json('data.id'))
        ->exists())->toBeTrue();
});

test('a movement recorded as already paid is settled by the actor', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload(['status' => 'paid']))
        ->assertCreated()
        ->assertJsonPath('data.status', 'paid')
        ->assertJsonPath('data.settled_by', $admin->id)
        ->assertJsonPath('data.allowed_transitions', ['pending']);
});

test('the initial status must fit the category', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload(['status' => 'held']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload([
            'direction' => 'income',
            'category' => 'reservation_deposit',
            'status' => 'paid',
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload([
            'direction' => 'income',
            'category' => 'reservation_deposit',
            'counterparty' => null,
            'unit_id' => $unit->id,
            'status' => 'held',
        ]))
        ->assertCreated()
        ->assertJsonPath('data.unit_number', $unit->unit_number)
        ->assertJsonPath('data.status', 'held');
});

test('the category must belong to the direction', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload(['category' => 'fine']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category');

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload([
            'direction' => 'income', 'category' => 'fine', 'counterparty' => null, 'unit_id' => $unit->id,
            'concept' => 'Multa · ruido fuera de horario', 'amount' => 80,
        ]))
        ->assertCreated()
        ->assertJsonPath('data.category', 'fine');
});

test('a unit from another location is rejected', function () {
    [$account, $location, $unit, $admin] = financeWorld();
    $otherLocation = Location::factory()->for($account)->create();
    $foreignUnit = Unit::factory()->create(['account_id' => $account->id, 'location_id' => $otherLocation->id]);

    $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload(['unit_id' => $foreignUnit->id]))
        ->assertNotFound();
});

test('front desk cannot see the ledger and outsiders get 404', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $frontDesk = User::factory()->create();
    createStaffMembership($account, $frontDesk);
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    $this->actingAs($frontDesk)->getJson(movementsBase($account, $location))->assertForbidden();
    $this->actingAs($frontDesk)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}/finances/summary")
        ->assertForbidden();
    $this->actingAs($frontDesk)->postJson(movementsBase($account, $location), expensePayload())->assertForbidden();

    $outsider = User::factory()->create();
    $this->actingAs($outsider)->getJson(movementsBase($account, $location))->assertNotFound();

    $movement = seedMovement($location, $admin);
    $otherAccount = Account::factory()->create();
    createStaffMembership($otherAccount, $outsider, AccountRole::AccountAdmin);
    $this->actingAs($outsider)
        ->postJson("/api/accounts/{$otherAccount->id}/finances/movements/{$movement->id}/status", ['status' => 'paid'])
        ->assertNotFound();
});

test('a location manager of the location can record and settle movements', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $manager = User::factory()->create();
    createStaffMembership($account, $manager);
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);

    $id = $this->actingAs($manager)
        ->postJson(movementsBase($account, $location), expensePayload())
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($manager)
        ->postJson("/api/accounts/{$account->id}/finances/movements/{$id}/status", ['status' => 'paid'])
        ->assertOk()
        ->assertJsonPath('data.status', 'paid');
});

test('fees and expenses flip between pending and paid and never elsewhere', function () {
    [$account, $location, $unit, $admin] = financeWorld();
    $movement = seedMovement($location, $admin);

    $this->actingAs($admin)
        ->postJson(statusUrl($account, $movement), ['status' => 'held'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    $this->actingAs($admin)
        ->postJson(statusUrl($account, $movement), ['status' => 'paid'])
        ->assertOk()
        ->assertJsonPath('data.status', 'paid')
        ->assertJsonPath('data.settled_by_name', $admin->name);

    $this->actingAs($admin)
        ->postJson(statusUrl($account, $movement), ['status' => 'pending'])
        ->assertOk()
        ->assertJsonPath('data.status', 'pending');

    $this->actingAs($admin)
        ->postJson(statusUrl($account, $movement), ['status' => 'voided', 'note' => 'Duplicado'])
        ->assertOk()
        ->assertJsonPath('data.status', 'voided')
        ->assertJsonPath('data.note', 'Duplicado')
        ->assertJsonPath('data.allowed_transitions', []);

    $this->actingAs($admin)
        ->postJson(statusUrl($account, $movement), ['status' => 'pending'])
        ->assertUnprocessable();

    expect(ActivityLog::query()
        ->where('event_type', ActivityEventType::MovementStatusChanged->value)
        ->where('subject_id', $movement->id)
        ->count())->toBe(3);
});

test('deposits follow their own lifecycle', function () {
    [$account, $location, $unit, $admin] = financeWorld();
    $deposit = seedMovement($location, $admin, [
        'direction' => 'income',
        'category' => 'reservation_deposit',
        'concept' => 'Depósito · Salón',
        'counterparty' => null,
        'unit_id' => $unit->id,
    ]);

    $this->actingAs($admin)->postJson(statusUrl($account, $deposit), ['status' => 'paid'])->assertUnprocessable();

    foreach (['held', 'to_refund', 'refunded'] as $next) {
        $this->actingAs($admin)
            ->postJson(statusUrl($account, $deposit), ['status' => $next])
            ->assertOk()
            ->assertJsonPath('data.status', $next);
    }

    $this->actingAs($admin)->postJson(statusUrl($account, $deposit), ['status' => 'held'])->assertUnprocessable();
});

test('the month list filters by month, direction, status, category and search', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    seedMovement($location, $admin, ['occurred_on' => '2026-08-16', 'concept' => 'Agua · áreas comunes']);
    seedMovement($location, $admin, ['occurred_on' => '2026-08-14', 'concept' => 'Luz · áreas comunes', 'status' => 'paid']);
    seedMovement($location, $admin, ['occurred_on' => '2026-07-30', 'concept' => 'Limpieza · julio', 'category' => 'cleaning']);
    FinancialMovement::factory()->income()->for($location)->create([
        'account_id' => $location->account_id, 'created_by' => $admin->id,
        'occurred_on' => '2026-08-15', 'concept' => 'Cuota · Parrilla', 'category' => 'reservation_fee', 'unit_id' => $unit->id,
    ]);

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=2026-08')
        ->assertOk()
        ->assertJsonCount(3, 'data')
        // Newest first.
        ->assertJsonPath('data.0.occurred_on', '2026-08-16');

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=2026-08&direction=expense')
        ->assertJsonCount(2, 'data');

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=2026-08&status=paid,voided')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.concept', 'Luz · áreas comunes');

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=2026-08&category=reservation_fee,reservation_deposit')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.unit_number', $unit->unit_number);

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=2026-08&search=agua')
        ->assertJsonCount(1, 'data');

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=2026-07')
        ->assertJsonCount(1, 'data');

    $this->actingAs($admin)
        ->getJson(movementsBase($account, $location).'?month=agosto')
        ->assertUnprocessable();
});

test('the summary totals the month and the outstanding balances', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $seed = fn (array $attrs) => seedMovement($location, $admin, $attrs);
    // Paid income in month (counts), pending income (receivable), deposits.
    $seed(['direction' => 'income', 'category' => 'reservation_fee', 'status' => 'paid', 'amount' => 50, 'occurred_on' => '2026-08-14']);
    $seed(['direction' => 'income', 'category' => 'reservation_fee', 'status' => 'paid', 'amount' => 50, 'occurred_on' => '2026-08-11']);
    $seed(['direction' => 'income', 'category' => 'reservation_fee', 'status' => 'pending', 'amount' => 150, 'occurred_on' => '2026-08-15']);
    $seed(['direction' => 'income', 'category' => 'reservation_deposit', 'status' => 'pending', 'amount' => 300, 'occurred_on' => '2026-08-15']);
    $seed(['direction' => 'income', 'category' => 'reservation_deposit', 'status' => 'held', 'amount' => 300, 'occurred_on' => '2026-07-20']);
    $seed(['direction' => 'income', 'category' => 'reservation_deposit', 'status' => 'to_refund', 'amount' => 300, 'occurred_on' => '2026-08-12']);
    // Expenses: paid in month, pending (payable), paid last month (ignored).
    $seed(['direction' => 'expense', 'status' => 'paid', 'amount' => 1180, 'occurred_on' => '2026-08-14']);
    $seed(['direction' => 'expense', 'status' => 'paid', 'amount' => 1400, 'occurred_on' => '2026-08-13']);
    $seed(['direction' => 'expense', 'status' => 'pending', 'amount' => 600, 'occurred_on' => '2026-08-16']);
    $seed(['direction' => 'expense', 'status' => 'paid', 'amount' => 999, 'occurred_on' => '2026-07-14']);
    // A voided row never counts.
    $seed(['direction' => 'expense', 'status' => 'voided', 'amount' => 5000, 'occurred_on' => '2026-08-14']);

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}/finances/summary?month=2026-08")
        ->assertOk()
        ->assertJson(['data' => [
            'month' => '2026-08',
            'income_total' => 100,
            'income_count' => 2,
            'expense_total' => 2580,
            'expense_count' => 2,
            'balance' => -2480,
            'receivable_total' => 450,
            'receivable_count' => 2,
            'payable_total' => 600,
            'payable_count' => 1,
            'deposits_held_total' => 300,
            'deposits_to_refund_total' => 300,
            'deposits_to_refund_count' => 1,
            'previous_month' => '2026-07',
            // July: no paid income, one paid expense of 999.
            'previous_balance' => -999,
            'income_by_category' => [
                ['category' => 'reservation_fee', 'total' => 100, 'count' => 2],
            ],
            'expense_by_category' => [
                ['category' => 'water', 'total' => 2580, 'count' => 2],
            ],
        ]]);
});

test('show returns the movement with its history newest first', function () {
    [$account, $location, $unit, $admin] = financeWorld();

    $id = $this->actingAs($admin)
        ->postJson(movementsBase($account, $location), expensePayload())
        ->assertCreated()->json('data.id');
    $movement = FinancialMovement::query()->findOrFail($id);
    $this->actingAs($admin)->postJson(statusUrl($account, $movement), ['status' => 'paid'])->assertOk();

    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/finances/movements/{$id}")
        ->assertOk()
        ->assertJsonPath('data.status', 'paid')
        ->assertJsonPath('data.reservation', null)
        ->assertJsonCount(2, 'history')
        ->assertJsonPath('history.0.event_type', 'movement.status_changed')
        ->assertJsonPath('history.0.previous_status', 'pending')
        ->assertJsonPath('history.0.status', 'paid')
        ->assertJsonPath('history.0.actor_name', $admin->name)
        ->assertJsonPath('history.1.event_type', 'movement.recorded');

    $frontDesk = User::factory()->create();
    createStaffMembership($account, $frontDesk);
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);
    $this->actingAs($frontDesk)->getJson("/api/accounts/{$account->id}/finances/movements/{$id}")->assertForbidden();
});

test('approving a reservation opens a fee and a deposit row once', function () {
    [$account, $location, $unit, $admin] = financeWorld();
    [$amenity, $reservation] = pendingReservationWithCharges($account, $location, $unit, $admin);

    expect(FinancialMovement::query()->count())->toBe(0);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$reservation->id}/approve")
        ->assertOk()
        ->assertJsonPath('data.status', 'approved')
        // The booking carries its ledger rows so the detail modal can show them.
        ->assertJsonCount(2, 'data.movements')
        ->assertJsonPath('data.movements.0.category', 'reservation_deposit')
        ->assertJsonPath('data.movements.0.status', 'pending')
        ->assertJsonPath('data.movements.1.category', 'reservation_fee');

    $rows = FinancialMovement::query()->where('reservation_id', $reservation->id)->orderBy('category')->get();
    expect($rows)->toHaveCount(2);

    $deposit = $rows->firstWhere('category.value', 'reservation_deposit');
    $fee = $rows->firstWhere('category.value', 'reservation_fee');
    expect($deposit->amount)->toBe(300)
        ->and($deposit->status)->toBe(MovementStatus::Pending)
        ->and($deposit->direction->value)->toBe('income')
        ->and($deposit->unit_id)->toBe($unit->id)
        ->and($deposit->concept)->toBe('Depósito · Salón de eventos')
        ->and($deposit->detail)->toStartWith('Reserva del lun')
        ->and($deposit->occurred_on->toDateString())->toBe(CarbonImmutable::now('America/Lima')->toDateString())
        ->and($fee->amount)->toBe(150)
        ->and($fee->concept)->toBe('Cuota · Salón de eventos');

    // Re-running the sync is a no-op thanks to the unique index guard.
    app(SyncReservationMovements::class)->openFor($reservation->fresh(), $admin);
    expect(FinancialMovement::query()->where('reservation_id', $reservation->id)->count())->toBe(2);
});

test('an instant booking opens its rows at creation and a rejection opens none', function () {
    [$account, $location, $unit, $admin] = financeWorld();
    $amenity = Amenity::factory()->for($location)->create([
        'account_id' => $account->id,
        'booking_mode' => BookingMode::Instant,
        'availability' => ['monday' => [['start' => '09:00', 'end' => '22:00']]],
        'fee_amount' => 50,
        'deposit_amount' => null,
    ]);
    $monday = CarbonImmutable::now('America/Lima')->addWeek()->next('Monday')->format('Y-m-d');

    $id = $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/locations/{$location->id}/reservations", [
            'amenity_id' => $amenity->id, 'unit_id' => $unit->id, 'date' => $monday, 'start' => '10:00', 'end' => '11:00',
        ])
        ->assertCreated()
        ->json('data.id');

    $rows = FinancialMovement::query()->where('reservation_id', $id)->get();
    expect($rows)->toHaveCount(1)
        ->and($rows->first()->category->value)->toBe('reservation_fee');

    [, $pending] = pendingReservationWithCharges($account, $location, $unit, $admin);
    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$pending->id}/reject", ['note' => 'No disponible'])
        ->assertOk();
    expect(FinancialMovement::query()->where('reservation_id', $pending->id)->count())->toBe(0);
});

test('cancelling a reservation voids pending rows and flags a held deposit for refund', function () {
    [$account, $location, $unit, $admin] = financeWorld();
    [, $reservation] = pendingReservationWithCharges($account, $location, $unit, $admin);

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$reservation->id}/approve")
        ->assertOk();

    $deposit = FinancialMovement::query()
        ->where('reservation_id', $reservation->id)->where('category', 'reservation_deposit')->firstOrFail();
    $this->actingAs($admin)->postJson(statusUrl($account, $deposit), ['status' => 'held'])->assertOk();

    $this->actingAs($admin)
        ->postJson("/api/accounts/{$account->id}/reservations/{$reservation->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', ReservationStatus::Cancelled->value);

    $byCategory = FinancialMovement::query()->where('reservation_id', $reservation->id)->get()
        ->mapWithKeys(fn (FinancialMovement $m) => [$m->category->value => $m->status->value])
        ->sortKeys();

    expect($byCategory->all())->toBe([
        'reservation_deposit' => 'to_refund',
        'reservation_fee' => 'voided',
    ]);
});
