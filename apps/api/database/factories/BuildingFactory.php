<?php

namespace Database\Factories;

use App\Models\Building;
use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Building>
 */
class BuildingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $location = Location::factory()->create();

        return [
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'name' => 'Torre '.fake()->unique()->randomLetter(),
            'sort_order' => 1,
        ];
    }
}
