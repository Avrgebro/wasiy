<?php

namespace Database\Factories;

use App\Enums\InvoiceStatus;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

class InvoiceFactory extends Factory
{
    public function definition(): array
    {
        $start = now()->addDays(7)->startOfDay();

        return [
            'account_id' => fn (array $attributes) => Subscription::query()->findOrFail($attributes['subscription_id'])->account_id,
            'subscription_id' => Subscription::factory(),
            'number' => 'F-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'period_starts_on' => $start,
            'period_ends_on' => $start->copy()->addMonth()->subDay(),
            'billable_units' => 40,
            'unit_price_minor' => 650,
            'amount_minor' => 26000,
            'currency' => 'PEN',
            'status' => InvoiceStatus::Pending,
            'due_on' => $start,
            'issued_at' => now(),
        ];
    }
}
