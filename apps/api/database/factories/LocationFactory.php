<?php

namespace Database\Factories;

use App\Enums\LocationType;
use App\Models\Account;
use App\Models\Building;
use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Location>
 */
class LocationFactory extends Factory
{
    /** Every Location has its default Building from birth (ADR 0037). */
    public function configure(): static
    {
        return $this->afterCreating(function (Location $location): void {
            Building::query()->firstOrCreate(
                ['location_id' => $location->id, 'name' => null],
                ['account_id' => $location->account_id, 'sort_order' => 0],
            );
        });
    }

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->streetName();

        return [
            'account_id' => Account::factory(),
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->bothify('####'),
            'type' => LocationType::MultifamilyBuilding,
            'timezone' => 'America/Lima',
            'address_line1' => fake()->streetAddress(),
            'district' => 'San Isidro',
            'city' => 'Lima',
            'country' => 'PE',
        ];
    }
}
