<?php

namespace Database\Factories;

use App\Enums\VisitConfirmation;
use App\Enums\VisitStatus;
use App\Models\Unit;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Visit> */
class VisitFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $unit = Unit::factory()->create();

        return [
            'account_id' => $unit->account_id,
            'location_id' => $unit->location_id,
            'unit_id' => $unit->id,
            'resident_id' => null,
            'visitor_name' => fake()->name(),
            'document' => null,
            'phone' => null,
            'confirmation' => VisitConfirmation::None,
            'notes' => null,
            'status' => VisitStatus::Inside,
            'checked_in_by' => User::factory(),
            'checked_in_at' => now(),
        ];
    }

    /** A resident's pre-registration for today, not yet at the desk. */
    public function expected(?string $on = null): static
    {
        return $this->state(fn () => [
            'status' => VisitStatus::Expected,
            'confirmation' => VisitConfirmation::PreRegistered,
            'checked_in_by' => null,
            'checked_in_at' => null,
            'expected_on' => $on ?? now()->toDateString(),
            'pre_registered_at' => now(),
        ]);
    }
}
