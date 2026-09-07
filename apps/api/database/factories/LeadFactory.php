<?php

namespace Database\Factories;

use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Lead> */
class LeadFactory extends Factory
{
    public function definition(): array
    {
        return ['source' => 'contacto', 'name' => fake()->name(), 'email' => fake()->safeEmail(), 'message' => fake()->sentence()];
    }
}
