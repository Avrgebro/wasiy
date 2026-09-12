<?php

namespace Database\Factories;

use App\Enums\ReservationStatus;
use App\Models\Amenity;
use App\Models\Reservation;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Reservation>
 */
class ReservationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $amenity = Amenity::factory()->create();
        $unit = Unit::factory()->create([
            'account_id' => $amenity->account_id,
            'location_id' => $amenity->location_id,
        ]);

        return [
            'account_id' => $amenity->account_id,
            'location_id' => $amenity->location_id,
            'amenity_id' => $amenity->id,
            'unit_id' => $unit->id,
            'resident_id' => null,
            'reserved_on' => now()->addDay()->toDateString(),
            'status' => ReservationStatus::Approved,
            'fee_snapshot_minor' => null,
            'deposit_snapshot_minor' => null,
            'created_by' => User::factory(),
        ];
    }

    public function pending(): self
    {
        return $this->state(['status' => ReservationStatus::Pending]);
    }
}
