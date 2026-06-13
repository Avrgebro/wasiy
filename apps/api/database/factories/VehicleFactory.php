<?php

namespace Database\Factories;

use App\Enums\RegistryStatus;
use App\Enums\VehicleType;
use App\Models\Location;
use App\Models\Unit;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $location = Location::factory()->create();
        $unit = Unit::factory()
            ->for($location->account)
            ->for($location)
            ->create();

        return [
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'unit_id' => $unit->id,
            'vehicle_type' => VehicleType::Car,
            'plate' => strtoupper(fake()->bothify('???-###')),
            'make' => fake()->optional()->company(),
            'model' => fake()->optional()->word(),
            'color' => fake()->optional()->safeColorName(),
            'status' => RegistryStatus::Active,
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
