<?php

namespace App\Actions\Staff;

use App\Actions\Invitations\IssueUserInvitation;
use App\Enums\ActivityEventType;
use App\Enums\UserInvitationPurpose;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\AccessAuthorizationService;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class InviteStaffUser
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
        private readonly ActivityLogger $activityLogger,
        private readonly IssueUserInvitation $issueInvitation,
    ) {}

    /**
     * Record the intent to grant access and email the invitee. No User row and
     * no role row is written here; AcceptStaffInvitation does both once the
     * recipient proves control of the address.
     *
     * @param  array{
     *     email: string,
     *     first_name: string,
     *     last_name: string,
     *     account_role?: string|null,
     *     location_assignments?: array<int, array{location_id: string, role: string}>
     * }  $data
     */
    public function handle(Account $account, User $actor, array $data): UserInvitation
    {
        return DB::transaction(function () use ($account, $actor, $data): UserInvitation {
            $email = $data['email'];
            $existingUser = User::query()->where('email', $email)->first();

            if ($existingUser instanceof User && $existingUser->isDeactivated()) {
                throw ValidationException::withMessages([
                    'email' => __('This user is deactivated and cannot be invited.'),
                ]);
            }

            if ($existingUser instanceof User && $this->access->isStaffForAccount($existingUser, $account)) {
                throw ValidationException::withMessages([
                    'email' => __('This user is already staff for this account.'),
                ]);
            }

            [$invitation, $token] = $this->issueInvitation->handle(
                purpose: UserInvitationPurpose::Staff,
                account: $account,
                email: $email,
                invitedBy: $actor,
                attributes: [
                    'location_id' => null,
                    // Snapshot the real identity when the User already exists.
                    'first_name' => $existingUser->first_name ?? $data['first_name'],
                    'last_name' => $existingUser->last_name ?? $data['last_name'],
                    'role_assignments' => [
                        'account_role' => $data['account_role'] ?? null,
                        'location_assignments' => array_values($data['location_assignments'] ?? []),
                    ],
                ],
            );

            $this->activityLogger->log(
                account: $account,
                eventType: ActivityEventType::StaffInvited,
                summary: "Se invitó a {$invitation->first_name} {$invitation->last_name} al equipo de {$account->name}.",
                metadata: $this->invitationMetadata($account, $actor, $invitation),
                actor: $actor,
                subjectType: 'user_invitation',
                subjectId: $invitation->id,
            );

            Notification::route('mail', $email)
                ->notify(UserInvitationPurpose::Staff->notification($invitation, $token));

            return $invitation;
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function invitationMetadata(Account $account, User $actor, UserInvitation $invitation): array
    {
        $assignments = $invitation->invitedLocationAssignments();

        $locations = Location::query()
            ->where('account_id', $account->id)
            ->whereIn('id', collect($assignments)->pluck('location_id'))
            ->get()
            ->keyBy('id');

        return [
            'actor_user_id' => $actor->id,
            'actor_user_name' => $actor->name,
            'actor_user_email' => $actor->email,
            'account_id' => $account->id,
            'account_name' => $account->name,
            'invitation_id' => $invitation->id,
            'invitation_email' => $invitation->email,
            'invitation_first_name' => $invitation->first_name,
            'invitation_last_name' => $invitation->last_name,
            // Named "invited" rather than "after": nothing has been granted yet.
            'invited_account_role' => $invitation->invitedAccountRole(),
            'invited_location_assignments' => collect($assignments)
                ->map(fn (array $assignment): array => [
                    'location_id' => $assignment['location_id'],
                    'location_name' => $locations->get($assignment['location_id'])?->name,
                    'role' => $assignment['role'],
                ])
                ->values()
                ->all(),
        ];
    }
}
