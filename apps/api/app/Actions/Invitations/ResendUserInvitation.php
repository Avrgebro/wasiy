<?php

namespace App\Actions\Invitations;

use App\Enums\ActivityEventType;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\ResidentInvitationNotification;
use App\Notifications\StaffInvitationNotification;
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

            $isStaff = $invitation->purpose === UserInvitationPurpose::Staff;
            $token = Str::random(64);
            $expiresDays = max(1, (int) config(
                $isStaff
                    ? 'wasiy.invitations.staff_expires_days'
                    : 'wasiy.invitations.resident_expires_days',
                14,
            ));

            $invitation->forceFill([
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addDays($expiresDays),
            ])->save();

            $this->activityLogger->log(
                account: $invitation->account,
                eventType: $isStaff
                    ? ActivityEventType::StaffInvitationResent
                    : ActivityEventType::ResidentInvitationResent,
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

            Notification::route('mail', $invitation->email)->notify(
                $isStaff
                    ? new StaffInvitationNotification($invitation, $token)
                    : new ResidentInvitationNotification($invitation, $token),
            );

            return $invitation;
        });
    }
}
