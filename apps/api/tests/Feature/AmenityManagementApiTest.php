<?php

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\BookingMode;
use App\Enums\LocationRole;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function amenityAdmin(Account $account): User
{
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);

    return $admin;
}

function amenityBase(Account $account, Location $location): string
{
    return "/api/accounts/{$account->id}/locations/{$location->id}/amenities";
}

function validAmenityPayload(array $overrides = []): array
{
    return [
        'name' => 'Salón de eventos',
        'is_reservable' => true,
        'booking_mode' => BookingMode::Approval->value,
        'open_days' => ['monday', 'wednesday'],
        'daily_capacity' => 1,
        'fee_amount_minor' => 150,
        'deposit_amount_minor' => 300,
        ...$overrides,
    ];
}

test('an admin can create an amenity with open days, capacity, fees, and approval mode', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload())
        ->assertCreated()
        ->assertJsonPath('data.name', 'Salón de eventos')
        ->assertJsonPath('data.slug', 'salon-de-eventos')
        ->assertJsonPath('data.booking_mode', 'approval')
        ->assertJsonPath('data.fee_amount_minor', 150)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.open_days', ['monday', 'wednesday'])
        ->assertJsonPath('data.daily_capacity', 1)
        ->assertJsonMissingPath('data.availability')
        ->assertJsonMissingPath('data.slot_minutes');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::AmenityCreated->value)->count())->toBe(1);
});

test('a location manager assigned elsewhere gets 403 and an outsider 404', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $otherLocation = Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $otherLocation, $manager, LocationRole::LocationManager);
    $outsider = amenityAdmin(Account::factory()->create());

    $this->actingAs($manager)
        ->postJson(amenityBase($account, $location), validAmenityPayload())
        ->assertForbidden();

    $this->actingAs($outsider)
        ->getJson(amenityBase($account, $location))
        ->assertNotFound();
});

test('a location manager assigned to the location can manage its amenities and front desk can only view', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $manager = User::factory()->create();
    grantLocationRole($account, $location, $manager, LocationRole::LocationManager);
    $frontDesk = User::factory()->create();
    grantLocationRole($account, $location, $frontDesk, LocationRole::FrontDesk);

    $this->actingAs($manager)
        ->postJson(amenityBase($account, $location), validAmenityPayload())
        ->assertCreated();

    $this->actingAs($frontDesk)->getJson(amenityBase($account, $location))->assertOk();
    $this->actingAs($frontDesk)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['name' => 'Gimnasio']))
        ->assertForbidden();
});

test('an amenity cannot be created under a location in another account', function () {
    $accountA = Account::factory()->create();
    $accountB = Account::factory()->create();
    $locationB = Location::factory()->for($accountB)->create();
    $adminA = amenityAdmin($accountA);

    // Scoped bindings: {location} resolved through {account} misses.
    $this->actingAs($adminA)
        ->postJson("/api/accounts/{$accountA->id}/locations/{$locationB->id}/amenities", validAmenityPayload())
        ->assertNotFound();
});

test('unknown or repeated weekdays and an empty week on a reservable amenity are rejected as validation errors', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['open_days' => ['monday', 'funday']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['open_days.1']);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['open_days' => ['monday', 'monday']]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['open_days.0']);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['open_days' => []]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['open_days']);

    // Absent altogether on a reservable amenity is the same as empty.
    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), collect(validAmenityPayload())->except('open_days')->all())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['open_days']);

    // A common space needs no open days.
    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['name' => 'Lobby', 'is_reservable' => false, 'open_days' => []]))
        ->assertCreated()
        ->assertJsonPath('data.open_days', []);
});

test('open days persist in calendar order and an update cannot close every day of a reservable amenity', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $id = $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['open_days' => ['sunday', 'monday', 'friday']]))
        ->assertCreated()
        ->assertJsonPath('data.open_days', ['monday', 'friday', 'sunday'])
        ->json('data.id');

    $this->actingAs($admin)
        ->patchJson(amenityBase($account, $location)."/{$id}", ['open_days' => []])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['open_days']);

    $this->actingAs($admin)
        ->patchJson(amenityBase($account, $location)."/{$id}", ['open_days' => ['saturday']])
        ->assertOk()
        ->assertJsonPath('data.open_days', ['saturday']);

    expect(Amenity::query()->findOrFail($id)->isOpenOn(CarbonImmutable::parse('2026-09-12')))->toBeTrue() // a Saturday
        ->and(Amenity::query()->findOrFail($id)->isOpenOn(CarbonImmutable::parse('2026-09-14')))->toBeFalse();
});

test('the daily capacity is a positive whole number up to 1000, or none', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['daily_capacity' => 0]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('daily_capacity');
    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['daily_capacity' => 1001]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('daily_capacity');

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['daily_capacity' => 4]))
        ->assertCreated()
        ->assertJsonPath('data.daily_capacity', 4)
        ->assertJsonMissingPath('data.capacity')
        ->assertJsonMissingPath('data.effective_booking_policy');

    // Absent or null in the payload means no limit.
    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), collect(validAmenityPayload(['name' => 'Parrilla']))->except('daily_capacity')->all())
        ->assertCreated()
        ->assertJsonPath('data.daily_capacity', null);
    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload(['name' => 'Gimnasio', 'daily_capacity' => null]))
        ->assertCreated()
        ->assertJsonPath('data.daily_capacity', null);
});

test('a non-reservable amenity stores instant mode and null fees', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $id = $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload([
            'name' => 'Lobby / recepción',
            'is_reservable' => false,
        ]))
        ->assertCreated()
        ->json('data.id');

    $amenity = Amenity::query()->findOrFail($id);

    expect($amenity->fee_amount_minor)->toBeNull()
        ->and($amenity->deposit_amount_minor)->toBeNull()
        ->and($amenity->booking_mode)->toBe(BookingMode::Instant);
});

test('renaming keeps the slug and updates log exactly one activity entry', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);
    $amenity = Amenity::factory()->for($location)->create(['account_id' => $account->id, 'name' => 'Gimnasio', 'slug' => 'gimnasio']);

    $this->actingAs($admin)
        ->patchJson(amenityBase($account, $location)."/{$amenity->id}", ['name' => 'Gimnasio renovado'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Gimnasio renovado')
        ->assertJsonPath('data.slug', 'gimnasio');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::AmenityUpdated->value)->count())->toBe(1);
});

test('deactivation reports future reservations, keeps the row listed, and blocks edits until reactivated', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);
    $amenity = Amenity::factory()->for($location)->create(['account_id' => $account->id]);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location)."/{$amenity->id}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'deactivated')
        ->assertJsonPath('meta.future_reservations', 0);

    $deactivatedList = $this->actingAs($admin)
        ->getJson(amenityBase($account, $location).'?status=deactivated')
        ->assertOk();
    expect($deactivatedList->json('data.0.id'))->toBe($amenity->id);

    $this->actingAs($admin)
        ->patchJson(amenityBase($account, $location)."/{$amenity->id}", ['name' => 'X'])
        ->assertForbidden();

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location)."/{$amenity->id}/reactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'active');

    expect(ActivityLog::query()->where('event_type', ActivityEventType::AmenityDeactivated->value)->count())->toBe(1)
        ->and(ActivityLog::query()->where('event_type', ActivityEventType::AmenityReactivated->value)->count())->toBe(1);
});

test('amenity photos use the shared photo pipeline and count toward the location tile', function () {
    Storage::fake('local');
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);
    $amenity = Amenity::factory()->for($location)->create(['account_id' => $account->id]);

    $this->actingAs($admin)
        ->post(
            amenityBase($account, $location)."/{$amenity->id}/photos",
            ['file' => UploadedFile::fake()->image('salon.jpg')],
            ['Accept' => 'application/json'],
        )
        ->assertCreated()
        ->assertJsonPath('data.is_cover', true);

    expect($amenity->photos()->count())->toBe(1)
        ->and($amenity->photos()->first()->photoable_type)->toBe('amenity');

    // The location detail now reports one active amenity.
    $this->actingAs($admin)
        ->getJson("/api/accounts/{$account->id}/locations/{$location->id}")
        ->assertJsonPath('data.active_amenities_count', 1);
});
