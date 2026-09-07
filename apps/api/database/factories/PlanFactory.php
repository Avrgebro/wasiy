<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class PlanFactory extends Factory
{
    public function definition(): array
    {
        return ['code' => fake()->unique()->slug(), 'name' => 'Esencial', 'unit_price_minor' => 450, 'currency' => 'PEN', 'features' => [], 'is_available' => true, 'location_limit' => 1, 'included_units' => 1];
    }
}
