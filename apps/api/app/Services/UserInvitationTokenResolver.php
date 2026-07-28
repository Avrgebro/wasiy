<?php

namespace App\Services;

use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\UserInvitation;

class UserInvitationTokenResolver
{
    /**
     * Resolve a pending invitation from its plaintext token.
     *
     * The lookup is scoped by purpose so a token issued for one flow cannot be
     * presented to the other, even though token_hash is globally unique.
     *
     * @param  array<int, string>  $with
     */
    public function resolve(string $token, UserInvitationPurpose $purpose, array $with = []): UserInvitation
    {
        $invitation = UserInvitation::query()
            ->with($with)
            ->where('token_hash', hash('sha256', $token))
            ->where('purpose', $purpose->value)
            ->first();

        if (! $invitation || $invitation->status !== UserInvitationStatus::Pending) {
            abort(410);
        }

        if ($invitation->expires_at->isPast()) {
            $invitation->forceFill(['status' => UserInvitationStatus::Expired])->save();
            abort(410);
        }

        return $invitation;
    }
}
