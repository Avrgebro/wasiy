<?php

namespace Database\Factories;

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FinancialMovement>
 */
class FinancialMovementFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'location_id' => Location::factory(),
            'direction' => MovementDirection::Expense,
            'category' => MovementCategory::Water,
            'status' => MovementStatus::Pending,
            'amount_minor' => fake()->numberBetween(5000, 200000),
            'concept' => 'Agua · áreas comunes',
            'detail' => null,
            'counterparty' => 'Sedapal',
            'unit_id' => null,
            'reservation_id' => null,
            'occurred_on' => now()->toDateString(),
            'due_on' => null,
            'note' => null,
            'created_by' => User::factory(),
        ];
    }

    /**
     * The composite foreign key requires account_id to match the location.
     */
    public function configure(): static
    {
        return $this->afterMaking(function (FinancialMovement $movement): void {
            if ($movement->account_id === null && $movement->location_id !== null) {
                $movement->account_id = Location::query()
                    ->findOrFail($movement->location_id)->account_id;
            }
        });
    }

    public function income(): self
    {
        return $this->state([
            'direction' => MovementDirection::Income,
            'category' => MovementCategory::OtherIncome,
            'concept' => 'Ingreso',
            'counterparty' => null,
        ]);
    }

    public function paid(): self
    {
        return $this->state(['status' => MovementStatus::Paid, 'settled_at' => now()]);
    }
}
