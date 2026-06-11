<?php

namespace Database\Factories;

use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'account_id' => Account::factory(),
            'location_id' => null,
            'actor_user_id' => User::factory(),
            'subject_type' => 'user',
            'subject_id' => User::factory(),
            'event_type' => ActivityEventType::StaffInvited,
            'summary' => 'Se registró una actividad.',
            'metadata' => [],
            'created_at' => now(),
        ];
    }
}
