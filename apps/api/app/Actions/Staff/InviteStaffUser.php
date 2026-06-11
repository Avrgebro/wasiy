<?php

namespace App\Actions\Staff;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Enums\UserInvitationPurpose;
use App\Enums\UserInvitationStatus;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\Location;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InviteStaffUser
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    /**
     * @param  array{
     *     email: string,
     *     first_name: string,
     *     last_name: string,
     *     account_role?: string|null,
     *     location_assignments?: array<int, array{location_id: string, role: string}>
     * }  $data
     * @return array{staff: User, invitation: UserInvitation}
     */
    public function handle(Account $account, User $actor, array $data): array
    {
        return DB::transaction(function () use ($account, $actor, $data): array {
            $email = $data['email'];
            $user = User::query()->where('email', $email)->first();

            if ($user instanceof User && $user->isDeactivated()) {
                throw ValidationException::withMessages([
                    'email' => __('This user is deactivated and cannot be invited.'),
                ]);
            }

            if ($user instanceof User && $this->isStaffForAccount($account, $user)) {
                throw ValidationException::withMessages([
                    'email' => __('This user is already staff for this account.'),
                ]);
            }

            UserInvitation::query()
                ->where('account_id', $account->id)
                ->where('email', $email)
                ->where('purpose', UserInvitationPurpose::Staff->value)
                ->where('status', UserInvitationStatus::Pending->value)
                ->where('expires_at', '<=', now())
                ->update(['status' => UserInvitationStatus::Expired->value]);

            $pendingInvitationExists = UserInvitation::query()
                ->where('account_id', $account->id)
                ->where('email', $email)
                ->where('purpose', UserInvitationPurpose::Staff->value)
                ->where('status', UserInvitationStatus::Pending->value)
                ->exists();

            if ($pendingInvitationExists) {
                throw ValidationException::withMessages([
                    'email' => __('This email already has a pending staff invitation for this account.'),
                ]);
            }

            if (! $user instanceof User) {
                $user = User::query()->create([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'email' => $email,
                    'password' => Str::random(64),
                ]);
            }

            $token = Str::random(64);
            $expiresDays = max(1, (int) config('wasiy.invitations.staff_expires_days', 14));

            $invitation = UserInvitation::query()->create([
                'account_id' => $account->id,
                'location_id' => null,
                'user_id' => $user->id,
                'email' => $email,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'token_hash' => hash('sha256', $token),
                'purpose' => UserInvitationPurpose::Staff,
                'status' => UserInvitationStatus::Pending,
                'expires_at' => now()->addDays($expiresDays),
                'accepted_at' => null,
                'invited_by_user_id' => $actor->id,
            ]);

            if (($data['account_role'] ?? null) !== null) {
                AccountUserRole::query()->updateOrCreate(
                    [
                        'account_id' => $account->id,
                        'user_id' => $user->id,
                    ],
                    ['role' => AccountRole::from($data['account_role'])],
                );
            }

            $this->replaceLocationAssignments(
                $account,
                $user,
                $data['location_assignments'] ?? [],
            );

            $this->activityLogger->log(
                account: $account,
                eventType: ActivityEventType::StaffInvited,
                summary: "Se invitó a {$user->name} al equipo de {$account->name}.",
                metadata: $this->invitationMetadata(
                    account: $account,
                    actor: $actor,
                    staff: $user,
                    invitation: $invitation,
                    accountRole: $data['account_role'] ?? null,
                    locationAssignments: $data['location_assignments'] ?? [],
                ),
                actor: $actor,
                subjectType: 'user',
                subjectId: $user->id,
            );

            return [
                'staff' => $this->loadStaffRelations($user, $account),
                'invitation' => $invitation,
            ];
        });
    }

    private function isStaffForAccount(Account $account, User $user): bool
    {
        return AccountUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $user->id)
            ->exists()
            || LocationUserRole::query()
                ->where('account_id', $account->id)
                ->where('user_id', $user->id)
                ->exists();
    }

    /**
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     */
    private function replaceLocationAssignments(Account $account, User $user, array $locationAssignments): void
    {
        $desiredAssignments = collect($locationAssignments)
            ->keyBy('location_id');

        $existingAssignments = LocationUserRole::query()
            ->where('account_id', $account->id)
            ->where('user_id', $user->id)
            ->get()
            ->keyBy('location_id');

        foreach ($existingAssignments as $locationId => $assignment) {
            if (! $desiredAssignments->has($locationId)) {
                $assignment->delete();
            }
        }

        foreach ($desiredAssignments as $locationId => $assignmentData) {
            $existingAssignment = $existingAssignments->get($locationId);

            if (! $existingAssignment instanceof LocationUserRole) {
                LocationUserRole::query()->create([
                    'account_id' => $account->id,
                    'location_id' => $locationId,
                    'user_id' => $user->id,
                    'role' => $assignmentData['role'],
                ]);

                continue;
            }

            if ($existingAssignment->role->value !== $assignmentData['role']) {
                $existingAssignment->forceFill([
                    'role' => $assignmentData['role'],
                ])->save();
            }
        }
    }

    private function loadStaffRelations(User $user, Account $account): User
    {
        return $user->load([
            'accountUserRoles' => fn ($query) => $query->where('account_id', $account->id),
            'locationUserRoles' => fn ($query) => $query
                ->where('account_id', $account->id)
                ->with('location'),
        ]);
    }

    /**
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     * @return array<string, mixed>
     */
    private function invitationMetadata(
        Account $account,
        User $actor,
        User $staff,
        UserInvitation $invitation,
        ?string $accountRole,
        array $locationAssignments,
    ): array {
        $locations = Location::query()
            ->where('account_id', $account->id)
            ->whereIn('id', collect($locationAssignments)->pluck('location_id'))
            ->get()
            ->keyBy('id');

        return [
            'actor_user_id' => $actor->id,
            'actor_user_name' => $actor->name,
            'actor_user_email' => $actor->email,
            'account_id' => $account->id,
            'account_name' => $account->name,
            'staff_user_id' => $staff->id,
            'staff_user_name' => $staff->name,
            'staff_user_email' => $staff->email,
            'invitation_id' => $invitation->id,
            'account_role_after' => $accountRole,
            'location_assignments_after' => collect($locationAssignments)
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
