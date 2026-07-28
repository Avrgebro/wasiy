<?php

namespace App\Actions\Invitations;

use App\Enums\ActivityEventType;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CancelUserInvitation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * Withdraw a pending invitation. Once Staff invitations carry an unclaimed
     * grant, an unopened inbox is live access, so this is the only way to take
     * it back before the expiry runs out.
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
                    'invitation' => __('Only pending invitations can be cancelled.'),
                ]);
            }

            $invitation->forceFill([
                'status' => UserInvitationStatus::Cancelled,
            ])->save();

            $this->activityLogger->log(
                account: $invitation->account,
                eventType: $invitation->purpose === UserInvitationPurpose::Staff
                    ? ActivityEventType::StaffInvitationCancelled
                    : ActivityEventType::ResidentInvitationCancelled,
                summary: "Se canceló la invitación de {$invitation->email}.",
                metadata: [
                    'actor_user_id' => $actor->id,
                    'actor_user_name' => $actor->name,
                    'actor_user_email' => $actor->email,
                    'invitation_id' => $invitation->id,
                    'invitation_email' => $invitation->email,
                    'invitation_purpose' => $invitation->purpose->value,
                ],
                location: $invitation->location,
                actor: $actor,
                subjectType: 'user_invitation',
                subjectId: $invitation->id,
            );

            return $invitation;
        });
    }
}
