<?php

namespace Database\Factories;

use App\Models\Account;
use App\Models\Plan;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return ['account_id' => Account::factory(), 'plan_id' => Plan::factory(), 'status' => 'trialing', 'unit_price_minor' => 450, 'billable_units' => 40, 'currency' => 'PEN', 'trial_starts_at' => now(), 'trial_ends_at' => now()->addDays(14), 'access_until' => now()->addDays(14), 'terms_accepted_at' => now()];
    }
}
