<?php

namespace Database\Factories;

use App\Enums\BookingMode;
use App\Models\Amenity;
use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Amenity>
 */
class AmenityFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->words(2, true);

        return [
            'location_id' => Location::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->bothify('####'),
            'is_reservable' => true,
            'booking_mode' => BookingMode::Instant,
            'availability' => [
                'monday' => [['start' => '09:00', 'end' => '22:00']],
            ],
        ];
    }

    /**
     * The composite foreign key requires account_id to match the location;
     * derive it after `for()` overrides resolve, unless given explicitly.
     */
    public function configure(): static
    {
        return $this->afterMaking(function (Amenity $amenity): void {
            if ($amenity->account_id === null && $amenity->location_id !== null) {
                $amenity->account_id = Location::query()
                    ->findOrFail($amenity->location_id)->account_id;
            }
        });
    }
}
