<?php

use App\Enums\AccountRole;
use App\Enums\LocationRole;
use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Enums\PackageStatus;
use App\Enums\RegistryStatus;
use App\Enums\ReservationStatus;
use App\Enums\VisitStatus;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\Package;
use App\Models\Reservation;
use App\Models\Resident;
use App\Models\StaffLocationRole;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

/**
 * @return array{Location, Unit, User, User}
 */
function dashboardWorld(int $autoCheckoutHours = 0): array
{
    $location = Location::factory()->create(['timezone' => 'America/Lima']);
    if ($autoCheckoutHours > 0) {
        $location->forceFill(['settings' => ['visitor_auto_checkout_hours' => $autoCheckoutHours]])->save();
    }
    $unit = Unit::factory()->for($location->account)->for($location)->create();

    $manager = User::factory()->create();
    grantLocationRole($location->account, $location, $manager, LocationRole::LocationManager);
    $desk = User::factory()->create();
    grantLocationRole($location->account, $location, $desk, LocationRole::FrontDesk);

    return [$location, $unit, $manager, $desk];
}

test('guests cannot view a location dashboard', function () {
    $location = Location::factory()->create();

    $this->getJson("/api/locations/{$location->id}/dashboard")
        ->assertUnauthorized();
});

test('users without an assignment cannot view a location dashboard', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertForbidden();
});

test('users with deleted location assignments cannot view a location dashboard', function () {
    $location = Location::factory()->create();
    $user = User::factory()->create();

    grantLocationRole($location->account, $location, $user, LocationRole::LocationManager);

    StaffLocationRole::query()
        ->where('location_id', $location->id)
        ->delete();

    $this->actingAs($user)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertForbidden();
});

test('users with deleted account admin assignments cannot view account location dashboards', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();

    $assignment = createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $assignment->delete();

    $this->actingAs($admin)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertForbidden();
});

test('the today strip counts visitors, flags overdue ones, and lists packages and reservations', function () {
    // Midday in Lima: rows created hours ago must stay on today's date (CI runs at 05:00 UTC).
    $this->travelTo(Carbon::parse('2026-09-05 15:00:00', 'UTC'));
    [$location, $unit, $manager] = dashboardWorld(autoCheckoutHours: 4);
    $base = ['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id];

    Visit::factory()->create([...$base, 'visitor_name' => 'Jorge Peña', 'checked_in_at' => now()->subHours(6)]);
    Visit::factory()->create([...$base, 'visitor_name' => 'Elena Vargas', 'checked_in_at' => now()->subMinutes(30)]);
    Visit::factory()->create([...$base, 'status' => VisitStatus::Left, 'checked_in_at' => now()->subHours(2), 'checked_out_at' => now()->subHour()]);
    // Another location's visitor never leaks in.
    Visit::factory()->create();

    Package::factory()->create([...$base, 'received_at' => now()->subDays(5)]);
    Package::factory()->create([...$base, 'received_at' => now()->subDay()]);
    Package::factory()->create([...$base, 'status' => PackageStatus::Delivered, 'delivered_at' => now()]);

    $amenity = Amenity::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id]);
    $today = now($location->timezone)->toDateString();
    Reservation::factory()->create([...$base, 'amenity_id' => $amenity->id, 'reserved_on' => $today, 'deposit_snapshot_minor' => 300]);
    Reservation::factory()->create([...$base, 'amenity_id' => $amenity->id, 'reserved_on' => $today]);
    Reservation::factory()->create([...$base, 'amenity_id' => $amenity->id, 'reserved_on' => $today, 'status' => ReservationStatus::Cancelled]);
    Reservation::factory()->create([...$base, 'amenity_id' => $amenity->id, 'reserved_on' => now($location->timezone)->addDay()->toDateString()]);

    FinancialMovement::factory()->create(['location_id' => $location->id]); // pending expense

    $response = $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('location.id', $location->id)
        ->assertJsonPath('today.visitors_inside_count', 2)
        ->assertJsonPath('today.visitors_overdue_count', 1)
        ->assertJsonPath('today.exits_today_count', 1)
        ->assertJsonPath('today.packages_pending_count', 2)
        ->assertJsonPath('today.reservations_today_count', 2)
        ->assertJsonPath('today.reservations_with_deposit_count', 1)
        ->assertJsonPath('today.pending_movements_count', 1)
        ->assertJsonCount(2, 'today.visitors_inside')
        ->assertJsonCount(2, 'today.packages_pending')
        ->assertJsonCount(2, 'today.reservations_today');

    // Longest stay first, flagged; the oldest package first.
    expect($response->json('today.visitors_inside.0.visitor_name'))->toBe('Jorge Peña')
        ->and($response->json('today.visitors_inside.0.is_overdue'))->toBeTrue()
        ->and($response->json('today.visitors_inside.1.is_overdue'))->toBeFalse()
        ->and($response->json('today.packages_oldest_received_at'))->not->toBeNull()
        ->and($response->json('today.packages_pending.0.received_at'))->toBeLessThan($response->json('today.packages_pending.1.received_at'))
        ->and($response->json('today.reservations_today.0.amenity_name'))->toBe($amenity->name);
});

test('no visitor is overdue when the location never auto checks out', function () {
    [$location, $unit, $manager] = dashboardWorld();
    Visit::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'checked_in_at' => now()->subDays(2)]);

    $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('today.visitors_overdue_count', 0)
        ->assertJsonPath('today.visitors_inside.0.is_overdue', false);
});

test('managers receive the management strip with dues, balances, deposits, occupancy and activity', function () {
    [$location, $unit, $manager] = dashboardWorld();
    $month = now($location->timezone)->format('Y-m');
    $vacant = Unit::factory()->for($location->account)->for($location)->create();
    $noPrimary = Unit::factory()->for($location->account)->for($location)->create();
    Unit::factory()->for($location->account)->for($location)->create(['status' => RegistryStatus::Inactive]);

    $primary = Resident::factory()->for($location->account)->create();
    UnitMembership::factory()->primaryContact()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $unit->id, 'resident_id' => $primary->id]);
    $notInvited = Resident::factory()->for($location->account)->create();
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $noPrimary->id, 'resident_id' => $notInvited->id]);
    $withUser = Resident::factory()->for($location->account)->create(['user_id' => User::factory()]);
    UnitMembership::factory()->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'unit_id' => $noPrimary->id, 'resident_id' => $withUser->id]);

    $dues = fn (Unit $target, MovementStatus $status, int $amount) => FinancialMovement::factory()->income()->create([
        'location_id' => $location->id,
        'unit_id' => $target->id,
        'category' => MovementCategory::MaintenanceDues,
        'period' => $month,
        'status' => $status,
        'amount_minor' => $amount,
    ]);
    $dues($unit, MovementStatus::Paid, 450);
    $dues($noPrimary, MovementStatus::Pending, 450);
    $dues($vacant, MovementStatus::Voided, 450);
    FinancialMovement::factory()->income()->create(['location_id' => $location->id, 'unit_id' => $noPrimary->id, 'category' => MovementCategory::OtherIncome, 'amount_minor' => 100]);
    FinancialMovement::factory()->create(['location_id' => $location->id, 'direction' => MovementDirection::Income, 'category' => MovementCategory::ReservationDeposit, 'status' => MovementStatus::Held, 'amount_minor' => 300]);

    // Seven entries in this location plus one elsewhere: the feed shows six.
    ActivityLog::factory()->count(7)->create(['account_id' => $location->account_id, 'location_id' => $location->id, 'actor_user_id' => $manager->id]);
    ActivityLog::factory()->create(['account_id' => $location->account_id]);

    $response = $this->actingAs($manager)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('management.month', $month)
        ->assertJsonPath('management.dues_issued_total_minor', 900)
        ->assertJsonPath('management.dues_collected_total_minor', 450)
        ->assertJsonPath('management.units_with_balance_count', 1)
        ->assertJsonPath('management.deposits_held_total_minor', 300)
        ->assertJsonPath('management.deposits_held_count', 1)
        ->assertJsonPath('management.residents_not_invited_count', 2)
        ->assertJsonPath('management.units_total', 3)
        ->assertJsonPath('management.units_occupied', 2)
        ->assertJsonPath('management.units_vacant', 1)
        ->assertJsonPath('management.units_without_primary_contact', 1)
        ->assertJsonCount(6, 'management.activity');

    expect($response->json('management.activity.0.actor_name'))->toBe($manager->name);
});

test('front desk staff get the today strip but never the management strip', function () {
    [$location, $unit, , $desk] = dashboardWorld();
    FinancialMovement::factory()->create(['location_id' => $location->id]);

    $this->actingAs($desk)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('today.visitors_inside_count', 0)
        ->assertJsonMissingPath('management');
});

test('account admins receive both strips for locations in their account', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    $this->actingAs($admin)
        ->getJson("/api/locations/{$location->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('today.packages_pending_count', 0)
        ->assertJsonPath('management.units_total', 0);
});
