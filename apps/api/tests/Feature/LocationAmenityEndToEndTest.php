<?php

use App\Enums\AccountRole;
use App\Enums\BookingMode;
use App\Enums\LocationType;
use App\Models\Account;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\Photo;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

/**
 * The M6 acceptance path from the roadmap, end to end through the real API:
 * create a Location with the full address, upload photos, override a
 * setting, add an Amenity with a two-window day and a closed day, deactivate
 * the Amenity, deactivate the Location, hit the last-active block, reactivate.
 */
test('the full m6 location and amenity path works end to end', function () {
    Storage::fake('local');

    $account = Account::factory()->create();
    Location::factory()->for($account)->create(['name' => 'Sede original']);
    $admin = User::factory()->create();
    createStaffMembership($account, $admin, AccountRole::AccountAdmin);
    $base = "/api/accounts/{$account->id}";

    // 1. Create a Location with every address component.
    $locationId = $this->actingAs($admin)
        ->postJson("{$base}/locations", [
            'name' => 'Torre Mirador',
            'type' => LocationType::MultifamilyBuilding->value,
            'timezone' => 'America/Lima',
            'address_line1' => 'Malecón de la Reserva 610',
            'address_line2' => 'Torre B',
            'district' => 'Miraflores',
            'city' => 'Lima',
            'state' => 'Lima Metropolitana',
            'postal_code' => '15074',
            'country' => 'PE',
            'phone' => '+51 1 302 4410',
            'contact_email' => 'mirador@horizonte.pe',
            'access_notes' => 'Ingreso vehicular por el malecón.',
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.formatted_address', 'Malecón de la Reserva 610, Miraflores, Lima')
        ->json('data.id');

    // 2. Upload photos; the first becomes the cover.
    $coverId = $this->actingAs($admin)
        ->post("{$base}/locations/{$locationId}/photos",
            ['file' => UploadedFile::fake()->image('fachada.jpg')],
            ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.is_cover', true)
        ->json('data.id');

    // 3. Override one setting at the account and another at the location.
    $this->actingAs($admin)
        ->putJson("{$base}/settings", ['announcements_email_residents' => true])
        ->assertOk();
    $this->actingAs($admin)
        ->putJson("{$base}/locations/{$locationId}/settings", ['visitor_auto_checkout_hours' => 12])
        ->assertOk()
        ->assertJsonPath('data.values.announcements_email_residents', true)
        ->assertJsonPath('data.explanation.announcements_email_residents.source', 'account')
        ->assertJsonPath('data.explanation.visitor_auto_checkout_hours.source', 'location');

    // 4. An Amenity with a two-window day, a closed sunday and half-day slots.
    $amenityId = $this->actingAs($admin)
        ->postJson("{$base}/locations/{$locationId}/amenities", [
            'name' => 'Salón de eventos',
            'is_reservable' => true,
            'booking_mode' => BookingMode::Approval->value,
            'slot_minutes' => 240,
            'availability' => [
                'wednesday' => [
                    ['start' => '09:00', 'end' => '13:00'],
                    ['start' => '16:00', 'end' => '22:00'],
                ],
                'sunday' => [],
            ],
            'fee_amount_minor' => 150,
            'deposit_amount_minor' => 300,
        ])
        ->assertCreated()
        ->assertJsonPath('data.slot_minutes', 240)
        ->json('data.id');

    expect(Amenity::query()->findOrFail($amenityId)->availabilitySchedule->isOpenOn('sunday'))->toBeFalse();

    // 5. The location detail now counts the amenity and carries the cover.
    $this->actingAs($admin)
        ->getJson("{$base}/locations/{$locationId}")
        ->assertJsonPath('data.active_amenities_count', 1)
        ->assertJsonPath('data.cover_photo_url', url("/api/photos/{$coverId}"));

    // 6. Deactivate the amenity; it leaves the active count but stays listed.
    $this->actingAs($admin)
        ->postJson("{$base}/locations/{$locationId}/amenities/{$amenityId}/deactivate")
        ->assertOk()
        ->assertJsonPath('meta.future_reservations', 0);
    $this->actingAs($admin)
        ->getJson("{$base}/locations/{$locationId}")
        ->assertJsonPath('data.active_amenities_count', 0);

    // 7. Deactivate the location, then retire the other one and hit the
    //    last-active-location block.
    $this->actingAs($admin)
        ->postJson("{$base}/locations/{$locationId}/deactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'deactivated');

    $original = Location::query()->where('name', 'Sede original')->sole();
    $this->actingAs($admin)
        ->postJson("{$base}/locations/{$original->id}/deactivate")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['location']);

    // 8. Reactivate and confirm it returns to accessible_locations.
    $this->actingAs($admin)
        ->postJson("{$base}/locations/{$locationId}/reactivate")
        ->assertOk()
        ->assertJsonPath('data.status', 'active');

    $this->actingAs($admin)->postJson('/api/context/account', ['account_id' => $account->id]);
    $accessible = $this->actingAs($admin)->getJson('/api/me')->json('accessible_locations');
    expect(collect($accessible)->pluck('id'))->toContain($locationId);

    // The photo file is still there after the whole lifecycle.
    Storage::disk('local')->assertExists(Photo::query()->findOrFail($coverId)->path);
});
