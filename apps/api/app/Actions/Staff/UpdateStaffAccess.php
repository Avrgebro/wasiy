<?php

namespace App\Actions\Staff;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\Location;
use App\Models\StaffMembership;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Applies a staff member's complete access — account role and location
 * assignments — as one atomic change. The two dimensions are mutually
 * exclusive (validated at the request layer); updating them together is
 * what makes promote/demote flows possible at all: sequential endpoints
 * would leave the user role-less (and thus non-staff) between calls.
 */
class UpdateStaffAccess
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
        private readonly SyncStaffLocationAssignments $syncLocationAssignments,
    ) {}

    /**
     * @param  array<int, array{location_id: string, role: string}>  $locationAssignments
     */
    public function handle(
        Account $account,
        User $actor,
        User $staff,
        ?string $accountRole,
        array $locationAssignments,
    ): User {
        return DB::transaction(function () use ($account, $actor, $staff, $accountRole, $locationAssignments): User {
            // Lock the Account's admin memberships so concurrent demotions
            // cannot each pass the last-admin check and leave zero admins.
            $adminMemberships = StaffMembership::query()
                ->where('account_id', $account->id)
                ->where('account_role', AccountRole::AccountAdmin->value)
                ->whereNull('deactivated_at')
                ->lockForUpdate()
                ->get();

            // The route's manageStaff check ran before this transaction
            // opened; a concurrent request may have removed the actor's admin
            // role since. Without this re-check two admins demoting each
            // other could both pass authorization and leave zero admins.
            if (! $adminMemberships->contains('user_id', $actor->id)) {
                abort(403);
            }

            $membership = StaffMembership::query()
                ->where('account_id', $account->id)
                ->where('user_id', $staff->id)
                ->lockForUpdate()
                ->first();

            // The controller's isStaffForAccount guard makes a missing
            // membership a race, not a normal path.
            if (! $membership instanceof StaffMembership) {
                abort(404);
            }

            $accountRoleBefore = $membership->account_role?->value;

            if ($this->isSuspended($membership, $staff) && $accountRole !== null && $accountRole !== $accountRoleBefore) {
                throw ValidationException::withMessages([
                    'account_role' => __('This user is deactivated and cannot be granted new access.'),
                ]);
            }

            if ($this->wouldRemoveOnlyActorAdmin($actor, $staff, $accountRole, $membership, $adminMemberships)) {
                throw ValidationException::withMessages([
                    'account_role' => __('Add another Account Admin before removing your own admin access.'),
                ]);
            }

            $membership->forceFill([
                'account_role' => $accountRole !== null ? AccountRole::from($accountRole) : null,
            ])->save();
            $this->logAccountRoleChange($account, $actor, $staff, $accountRoleBefore, $accountRole);

            $changes = $this->syncLocationAssignments->sync($membership, $locationAssignments);

            // Inspect the change-set instead of pre-querying: a grant to a
            // suspended member throws here and the transaction rolls the
            // sync back.
            if ($this->isSuspended($membership, $staff)
                && $changes->contains(fn (array $change): bool => $change['role_after'] !== null)) {
                throw ValidationException::withMessages([
                    'location_assignments' => __('This user is deactivated and cannot be granted new access.'),
                ]);
            }

            foreach ($changes as $change) {
                if ($change['location'] instanceof Location) {
                    $this->logLocationAssignmentChange(
                        account: $account,
                        actor: $actor,
                        staff: $staff,
                        location: $change['location'],
                        roleBefore: $change['role_before'],
                        roleAfter: $change['role_after'],
                    );
                }
            }

            return $staff->loadStaffRelationsForAccount($account);
        });
    }

    /**
     * A member is suspended when either their membership in this Account is
     * deactivated or their User is platform-banned.
     */
    private function isSuspended(StaffMembership $membership, User $staff): bool
    {
        return $membership->isDeactivated() || $staff->isDeactivated();
    }

    /**
     * @param  Collection<int, StaffMembership>  $adminMemberships
     */
    private function wouldRemoveOnlyActorAdmin(
        User $actor,
        User $staff,
        ?string $accountRole,
        StaffMembership $membership,
        Collection $adminMemberships,
    ): bool {
        if ($accountRole !== null || $actor->id !== $staff->id) {
            return false;
        }

        if ($membership->account_role !== AccountRole::AccountAdmin) {
            return false;
        }

        return $adminMemberships
            ->where('user_id', '!=', $actor->id)
            ->isEmpty();
    }

    private function logAccountRoleChange(
        Account $account,
        User $actor,
        User $staff,
        ?string $accountRoleBefore,
        ?string $accountRoleAfter,
    ): void {
        if ($accountRoleBefore === $accountRoleAfter) {
            return;
        }

        $eventType = $accountRoleAfter === null
            ? ActivityEventType::StaffRoleRemoved
            : ActivityEventType::StaffRoleAssigned;

        $summary = $accountRoleAfter === null
            ? "Se quitó el rol de administrador de cuenta a {$staff->name} en {$account->name}."
            : "{$staff->name} recibió el rol de administrador de cuenta en {$account->name}.";

        $this->activityLogger->log(
            account: $account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'actor_user_email' => $actor->email,
                'account_id' => $account->id,
                'account_name' => $account->name,
                'staff_user_id' => $staff->id,
                'staff_user_name' => $staff->name,
                'staff_user_email' => $staff->email,
                'account_role_before' => $accountRoleBefore,
                'account_role_after' => $accountRoleAfter,
            ],
            actor: $actor,
            subjectType: 'user',
            subjectId: $staff->id,
        );
    }

    private function logLocationAssignmentChange(
        Account $account,
        User $actor,
        User $staff,
        Location $location,
        ?string $roleBefore,
        ?string $roleAfter,
    ): void {
        if ($roleBefore === $roleAfter) {
            return;
        }

        $eventType = match (true) {
            $roleBefore === null => ActivityEventType::StaffRoleAssigned,
            $roleAfter === null => ActivityEventType::StaffRoleRemoved,
            default => ActivityEventType::StaffLocationsChanged,
        };

        $summary = match ($eventType) {
            ActivityEventType::StaffRoleAssigned => "{$staff->name} recibió el rol {$this->locationRoleLabel($roleAfter)} en {$location->name}.",
            ActivityEventType::StaffRoleRemoved => "Se quitó el rol {$this->locationRoleLabel($roleBefore)} a {$staff->name} en {$location->name}.",
            ActivityEventType::StaffLocationsChanged => "{$staff->name} cambió de {$this->locationRoleLabel($roleBefore)} a {$this->locationRoleLabel($roleAfter)} en {$location->name}.",
            default => "{$staff->name} tuvo un cambio de rol en {$location->name}.",
        };

        $this->activityLogger->log(
            account: $account,
            eventType: $eventType,
            summary: $summary,
            metadata: [
                'actor_user_id' => $actor->id,
                'actor_user_name' => $actor->name,
                'actor_user_email' => $actor->email,
                'account_id' => $account->id,
                'account_name' => $account->name,
                'staff_user_id' => $staff->id,
                'staff_user_name' => $staff->name,
                'staff_user_email' => $staff->email,
                'location_id' => $location->id,
                'location_name' => $location->name,
                'location_role_before' => $roleBefore,
                'location_role_after' => $roleAfter,
            ],
            location: $location,
            actor: $actor,
            subjectType: 'user',
            subjectId: $staff->id,
        );
    }

    private function locationRoleLabel(?string $role): string
    {
        return match ($role) {
            'front_desk' => 'Recepción / Seguridad',
            'location_manager' => 'Administrador de ubicación',
            default => 'sin rol',
        };
    }
}
