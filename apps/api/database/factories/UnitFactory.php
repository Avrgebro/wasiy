<?php

namespace Database\Factories;

use App\Enums\RegistryStatus;
use App\Enums\UnitType;
use App\Models\Location;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Unit>
 */
class UnitFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $location = Location::factory()->create();

        return [
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'unit_number' => fake()->unique()->bothify('###?'),
            // Defaults to the location's unnamed Building; tests name towers explicitly.
            'building_name' => null,
            'floor' => fake()->optional()->numberBetween(1, 20),
            'status' => RegistryStatus::Active,
            'type' => UnitType::Apartment,
            'maintenance_fee_minor' => null,
            'notes' => null,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RegistryStatus::Inactive,
        ]);
    }
}
