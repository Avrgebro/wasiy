<?php

namespace App\Actions\Staff;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\UserInvitationStatus;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\ActivityLogger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AcceptStaffInvitation
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly SyncStaffLocationAssignments $syncLocationAssignments,
    ) {}

    /**
     * Turn a pending Staff invitation into a real User and real role rows.
     *
     * @param  array{first_name?: string, last_name?: string, password?: string}  $data
     * @return array{user: User, skipped_location_ids: array<int, string>}
     */
    public function handle(UserInvitation $invitation, ?User $authenticatedUser, array $data): array
    {
        return DB::transaction(function () use ($invitation, $authenticatedUser, $data): array {
            $invitation = UserInvitation::query()
                ->with(['account'])
                ->lockForUpdate()
                ->findOrFail($invitation->id);

            // Re-check under the lock: a concurrent accept may have landed
            // between the token resolving and this transaction opening.
            abort_unless($invitation->status === UserInvitationStatus::Pending, 410);

            $account = $invitation->account;

            abort_if($account === null || $account->trashed(), 410);

            $user = User::query()->where('email', $invitation->email)->first();

            if ($user instanceof User) {
                // An existing account must prove it is theirs before it gains
                // access to another Account.
                abort_if($authenticatedUser === null, 401);
                abort_unless($authenticatedUser->id === $user->id, 409);
            } else {
                $user = $this->createUserFromInvitation($invitation, $data);
            }

            abort_if($user->isDeactivated(), 403);

            [$assignments, $skippedLocationIds] = $this->partitionAssignments($invitation);
            $accountRole = $invitation->invitedAccountRole();

            if ($accountRole === null && $assignments === []) {
                throw ValidationException::withMessages([
                    'token' => __('This invitation no longer grants any access.'),
                ]);
            }

            if ($accountRole !== null) {
                AccountUserRole::query()->updateOrCreate(
                    [
                        'account_id' => $account->id,
                        'user_id' => $user->id,
                    ],
                    ['role' => AccountRole::from($accountRole)],
                );
            }

            $this->syncLocationAssignments->sync($account, $user, $assignments);

            $invitation->forceFill([
                'user_id' => $user->id,
                'status' => UserInvitationStatus::Accepted,
                'accepted_at' => now(),
            ])->save();

            $this->activityLogger->log(
                account: $account,
                eventType: ActivityEventType::StaffInvitationAccepted,
                summary: "{$user->name} aceptó la invitación al equipo de {$account->name}.",
                metadata: [
                    'account_id' => $account->id,
                    'account_name' => $account->name,
                    'invitation_id' => $invitation->id,
                    'invitation_email' => $invitation->email,
                    'staff_user_id' => $user->id,
                    'staff_user_name' => $user->name,
                    'staff_user_email' => $user->email,
                    'account_role_after' => $accountRole,
                    'location_assignments_after' => $assignments,
                    'skipped_location_ids' => $skippedLocationIds,
                ],
                actor: $user,
                subjectType: 'user',
                subjectId: $user->id,
            );

            return [
                'user' => $user->loadStaffRelationsForAccount($account),
                'skipped_location_ids' => $skippedLocationIds,
            ];
        });
    }

    /**
     * @param  array{first_name?: string, last_name?: string, password?: string}  $data
     */
    private function createUserFromInvitation(UserInvitation $invitation, array $data): User
    {
        try {
            return User::query()->create([
                'first_name' => $data['first_name'] ?? $invitation->first_name,
                'last_name' => $data['last_name'] ?? $invitation->last_name,
                'email' => $invitation->email,
                'password' => $data['password'] ?? '',
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'email' => __('This email was registered by a concurrent request. Try again.'),
            ]);
        }
    }

    /**
     * Drop assignments whose Location no longer resolves inside the Account.
     * A Location can be soft-deleted during the invitation's lifetime, and one
     * dead Location should not block the rest of the grant.
     *
     * @return array{0: array<int, array{location_id: string, role: string}>, 1: array<int, string>}
     */
    private function partitionAssignments(UserInvitation $invitation): array
    {
        $assignments = $invitation->invitedLocationAssignments();

        if ($assignments === []) {
            return [[], []];
        }

        $liveLocationIds = Location::query()
            ->where('account_id', $invitation->account_id)
            ->whereIn('id', collect($assignments)->pluck('location_id'))
            ->pluck('id')
            ->all();

        $live = [];
        $skipped = [];

        foreach ($assignments as $assignment) {
            if (in_array($assignment['location_id'], $liveLocationIds, true)) {
                $live[] = $assignment;

                continue;
            }

            $skipped[] = $assignment['location_id'];
        }

        return [$live, $skipped];
    }
}
