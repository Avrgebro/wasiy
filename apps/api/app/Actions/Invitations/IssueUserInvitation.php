<?php

namespace App\Actions\Invitations;

use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The single owner of invitation issuance: expires stale pendings and
 * creates the row with a hashed token (the plaintext is never stored).
 * Returns the plaintext token so the caller can mail it after logging;
 * must run inside the caller's transaction.
 */
class IssueUserInvitation
{
    /**
     * @param  array<string, mixed>  $attributes  purpose-specific UserInvitation columns
     * @return array{0: UserInvitation, 1: string}  the invitation and its plaintext token
     */
    public function handle(
        UserInvitationPurpose $purpose,
        Account $account,
        string $email,
        User $invitedBy,
        array $attributes,
    ): array {
        UserInvitation::query()
            ->where('account_id', $account->id)
            ->where('email', $email)
            ->where('purpose', $purpose->value)
            ->where('status', UserInvitationStatus::Pending->value)
            ->where('expires_at', '<=', now())
            ->update(['status' => UserInvitationStatus::Expired->value]);

        $token = Str::random(64);

        try {
            $invitation = UserInvitation::query()->create([
                'account_id' => $account->id,
                'user_id' => null,
                'email' => $email,
                'token_hash' => hash('sha256', $token),
                'purpose' => $purpose,
                'status' => UserInvitationStatus::Pending,
                'expires_at' => now()->addDays($purpose->expiresDays()),
                'accepted_at' => null,
                'invited_by_user_id' => $invitedBy->id,
                ...$attributes,
            ]);
        } catch (UniqueConstraintViolationException) {
            // The partial unique index on live pendings is the real guard
            // against duplicates; no racy pre-check needed.
            throw ValidationException::withMessages([
                'email' => $purpose->pendingConflictMessage(),
            ]);
        }

        return [$invitation, $token];
    }
}
