<?php

namespace Database\Factories;

use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\UserInvitation;
use Illuminate\Database\Eloquent\Factories\Factory;
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
            // Must match how production hashes tokens, or the row can never be
            // found by UserInvitationTokenResolver.
            'token_hash' => hash('sha256', Str::random(64)),
            'purpose' => UserInvitationPurpose::Staff,
            'role_assignments' => null,
            'status' => UserInvitationStatus::Pending,
            'expires_at' => now()->addDays(14),
            'accepted_at' => null,
            'invited_by_user_id' => null,
        ];
    }

    /**
     * Persist the invitation and hand back the plaintext token, so tests can
     * drive the real token endpoints instead of reaching into the database.
     *
     * @param  array<string, mixed>  $attributes
     * @return array{invitation: UserInvitation, token: string}
     */
    public function createWithToken(array $attributes = []): array
    {
        $token = Str::random(64);

        $invitation = $this->state([
            'token_hash' => hash('sha256', $token),
        ])->create($attributes);

        return [
            'invitation' => $invitation,
            'token' => $token,
        ];
    }

    public function forToken(string $token): static
    {
        return $this->state(['token_hash' => hash('sha256', $token)]);
    }

    public function resident(): static
    {
        return $this->state(['purpose' => UserInvitationPurpose::Resident]);
    }

    public function expired(): static
    {
        return $this->state([
            'status' => UserInvitationStatus::Expired,
            'expires_at' => now()->subDay(),
        ]);
    }

    public function accepted(): static
    {
        return $this->state([
            'status' => UserInvitationStatus::Accepted,
            'accepted_at' => now(),
        ]);
    }

    public function cancelled(): static
    {
        return $this->state(['status' => UserInvitationStatus::Cancelled]);
    }
}
