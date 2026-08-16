<?php

namespace App\Actions\Residents;

use App\Actions\Invitations\IssueUserInvitation;
use App\Enums\ActivityEventType;
use App\Enums\RegistryStatus;
use App\Enums\UserInvitationPurpose;
use App\Models\Resident;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InviteResidentUser
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
        private readonly IssueUserInvitation $issueInvitation,
    ) {}

    /**
     * @param  array{email?: string|null}  $data
     * @return array{resident: Resident, invitation: UserInvitation}
     */
    public function handle(Resident $resident, User $actor, array $data): array
    {
        return DB::transaction(function () use ($resident, $actor, $data): array {
            $resident->loadMissing(['account', 'unitMemberships.location']);

            // Authorize before any state check, so the validation messages below
            // cannot be used to probe residents in other accounts.
            $location = $this->access->manageableInvitationLocationForResident($actor, $resident);

            if (! $location) {
                abort(403);
            }

            if ($resident->status !== RegistryStatus::Active) {
                throw ValidationException::withMessages([
                    'resident' => __('Inactive residents cannot be invited to the portal.'),
                ]);
            }

            if ($resident->user_id !== null) {
                throw ValidationException::withMessages([
                    'resident' => __('This resident already has portal access.'),
                ]);
            }

            $email = $data['email'] ?? $resident->email;

            if (! is_string($email) || trim($email) === '') {
                throw ValidationException::withMessages([
                    'email' => __('An invitation email is required for this resident.'),
                ]);
            }

            $email = Str::lower(trim($email));

            [$invitation, $token] = $this->issueInvitation->handle(
                purpose: UserInvitationPurpose::Resident,
                account: $resident->account,
                email: $email,
                invitedBy: $actor,
                attributes: [
                    'location_id' => $location->id,
                    'resident_id' => $resident->id,
                    'first_name' => $resident->first_name,
                    'last_name' => $resident->last_name,
                ],
            );

            $this->activityLogger->log(
                account: $resident->account,
                eventType: ActivityEventType::ResidentInvited,
                summary: "Se invitó a {$resident->name} al portal de residentes.",
                metadata: [
                    'actor_user_id' => $actor->id,
                    'actor_user_name' => $actor->name,
                    'actor_user_email' => $actor->email,
                    'resident_id' => $resident->id,
                    'resident_name' => $resident->name,
                    'resident_email' => $resident->email,
                    'invitation_id' => $invitation->id,
                    'invitation_email' => $email,
                    'location_id' => $location->id,
                    'location_name' => $location->name,
                ],
                location: $location,
                actor: $actor,
                subjectType: 'resident',
                subjectId: $resident->id,
            );

            // After commit: a rolled-back transaction must not have mailed a
            // token whose hash never landed.
            DB::afterCommit(fn () => Notification::route('mail', $email)
                ->notify(UserInvitationPurpose::Resident->notification($invitation, $token)));

            return [
                'resident' => $resident->fresh()->loadSummary(),
                'invitation' => $invitation,
            ];
        });
    }
}
