<?php

namespace Database\Factories;

use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\UserInvitation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<UserInvitation>
 */
class UserInvitationFactory extends Factory
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
            'user_id' => null,
            'resident_id' => null,
            'email' => fake()->unique()->safeEmail(),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'token_hash' => Hash::make(Str::random(64)),
            'purpose' => UserInvitationPurpose::Staff,
            'status' => UserInvitationStatus::Pending,
            'expires_at' => now()->addDays(14),
            'accepted_at' => null,
            'invited_by_user_id' => null,
        ];
    }
}
