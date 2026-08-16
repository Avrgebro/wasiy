<?php

namespace App\Actions\Invitations;

use App\Enums\UserInvitationStatus;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ResendUserInvitation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * Issue a fresh token and mail it again. The plaintext token is never
     * stored, so a lost invitation email cannot be recovered — only replaced.
     * Rotating the hash invalidates the previous link.
     */
    public function handle(UserInvitation $invitation, User $actor): UserInvitation
    {
        return DB::transaction(function () use ($invitation, $actor): UserInvitation {
            $invitation = UserInvitation::query()
                ->with(['account', 'location'])
                ->lockForUpdate()
                ->findOrFail($invitation->id);

            if ($invitation->status !== UserInvitationStatus::Pending) {
                throw ValidationException::withMessages([
                    'invitation' => __('Only pending invitations can be resent.'),
                ]);
            }

            $token = Str::random(64);

            $invitation->forceFill([
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addDays($invitation->purpose->expiresDays()),
            ])->save();

            $this->activityLogger->log(
                account: $invitation->account,
                eventType: $invitation->purpose->resentActivityEvent(),
                summary: "Se reenvió la invitación de {$invitation->email}.",
                metadata: [
                    'actor_user_id' => $actor->id,
                    'actor_user_name' => $actor->name,
                    'actor_user_email' => $actor->email,
                    'invitation_id' => $invitation->id,
                    'invitation_email' => $invitation->email,
                    'invitation_purpose' => $invitation->purpose->value,
                    'expires_at' => $invitation->expires_at?->toJSON(),
                ],
                location: $invitation->location,
                actor: $actor,
                subjectType: 'user_invitation',
                subjectId: $invitation->id,
            );

            // After commit: rolling back would leave the recipient holding a
            // dead link while the old token stays live.
            DB::afterCommit(fn () => Notification::route('mail', $invitation->email)->notify(
                $invitation->purpose->notification($invitation, $token),
            ));

            return $invitation;
        });
    }
}
