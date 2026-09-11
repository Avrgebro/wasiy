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
use App\Services\SettingsResolver;
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
        'capacity' => 80,
        'availability' => [
            'monday' => [['start' => '09:00', 'end' => '22:00']],
            'wednesday' => [
                ['start' => '09:00', 'end' => '13:00'],
                ['start' => '16:00', 'end' => '22:00'],
            ],
        ],
        'fee_amount' => 150,
        'deposit_amount' => 300,
        ...$overrides,
    ];
}

test('an admin can create an amenity with availability, fees, and approval mode', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload())
        ->assertCreated()
        ->assertJsonPath('data.name', 'Salón de eventos')
        ->assertJsonPath('data.slug', 'salon-de-eventos')
        ->assertJsonPath('data.booking_mode', 'approval')
        ->assertJsonPath('data.fee_amount', 150)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.availability.wednesday.1.start', '16:00');

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

test('overlapping windows and inverted ranges are rejected as validation errors', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload([
            'availability' => [
                'thursday' => [
                    ['start' => '13:00', 'end' => '18:00'],
                    ['start' => '17:00', 'end' => '22:00'],
                ],
            ],
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['availability']);

    $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload([
            'availability' => ['friday' => [['start' => '20:00', 'end' => '08:00']]],
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['availability']);
});

test('a day with zero windows persists as closed', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $id = $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload([
            'availability' => ['monday' => [['start' => '09:00', 'end' => '22:00']], 'sunday' => []],
        ]))
        ->json('data.id');

    $amenity = Amenity::query()->findOrFail($id);

    expect($amenity->availabilitySchedule->isOpenOn('monday'))->toBeTrue()
        ->and($amenity->availabilitySchedule->isOpenOn('sunday'))->toBeFalse()
        ->and($amenity->availability)->not->toHaveKey('sunday');
});

test('null policy fields resolve through the location to the account and a set value wins', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $account->forceFill(['settings' => ['reservation_max_advance_days' => 60]])->save();
    $location->forceFill(['settings' => ['reservation_max_concurrent_per_unit' => 3]])->save();

    $amenity = Amenity::factory()->for($location)->create([
        'max_advance_days' => null,
        'max_concurrent_per_unit' => null,
        'cancellation_window_hours' => 48,
    ]);

    $policy = app(SettingsResolver::class)->bookingPolicyFor($amenity);

    expect($policy['max_advance_days'])->toBe(['value' => 60, 'source' => 'location'])
        ->and($policy['max_concurrent_per_unit'])->toBe(['value' => 3, 'source' => 'location'])
        ->and($policy['cancellation_window_hours'])->toBe(['value' => 48, 'source' => 'amenity']);
});

test('a non-reservable amenity stores null booking policy and fees', function () {
    $account = Account::factory()->create();
    $location = Location::factory()->for($account)->create();
    $admin = amenityAdmin($account);

    $id = $this->actingAs($admin)
        ->postJson(amenityBase($account, $location), validAmenityPayload([
            'name' => 'Lobby / recepción',
            'is_reservable' => false,
        ]))
        ->assertCreated()
        ->assertJsonPath('data.effective_booking_policy', null)
        ->json('data.id');

    $amenity = Amenity::query()->findOrFail($id);

    expect($amenity->fee_amount)->toBeNull()
        ->and($amenity->deposit_amount)->toBeNull()
        ->and($amenity->max_advance_days)->toBeNull()
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
