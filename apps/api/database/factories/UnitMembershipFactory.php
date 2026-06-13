<?php

namespace Database\Factories;

use App\Enums\RegistryStatus;
use App\Enums\ResidentType;
use App\Models\Location;
use App\Models\Resident;
use App\Models\Unit;
use App\Models\UnitMembership;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UnitMembership>
 */
class UnitMembershipFactory extends Factory
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
        $resident = Resident::factory()
            ->for($location->account)
            ->create();

        return [
            'account_id' => $location->account_id,
            'location_id' => $location->id,
            'unit_id' => $unit->id,
            'resident_id' => $resident->id,
            'resident_type' => ResidentType::Owner,
            'status' => RegistryStatus::Active,
            'is_primary_contact' => false,
            'started_at' => now()->toDateString(),
            'ended_at' => null,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RegistryStatus::Inactive,
        ]);
    }

    public function primaryContact(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_primary_contact' => true,
        ]);
    }
}
