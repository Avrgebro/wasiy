<?php

namespace App\Actions\Invitations;

use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

/**
 * Creates the User an accepted/claimed invitation is for, translating the
 * concurrent-registration race into the shared validation message. The
 * password is hashed by the model cast. Must run inside the caller's
 * transaction.
 */
class CreateUserFromInvitation
{
    public function handle(UserInvitation $invitation, string $firstName, string $lastName, string $password): User
    {
        try {
            return User::query()->create([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $invitation->email,
                'password' => $password,
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'email' => __('This email was registered by a concurrent request. Try again.'),
            ]);
        }
    }
}
