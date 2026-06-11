<?php

namespace App\Actions\Staff;

use App\Enums\AccountRole;
use App\Enums\ActivityEventType;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\LocationUserRole;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateStaffAccountRole
{
    public function __construct(
        private readonly ActivityLogger $activityLogger,
    ) {}

    public function handle(Account $account, User $actor, User $staff, ?string $accountRole): User
    {
        abort_unless($this->isStaffForAccount($account, $staff), 404);

        return DB::transaction(function () use ($account, $actor, $staff, $accountRole): User {
            $currentAccountRole = AccountUserRole::query()
                ->where('account_id', $account->id)
                ->where('user_id', $staff->id)
                ->first();

            if ($this->wouldRemoveOnlyActorAdmin($account, $actor, $staff, $accountRole, $currentAccountRole)) {
                throw ValidationException::withMessages([
                    'account_role' => __('Add another Account Admin before removing your own admin access.'),
                ]);
            }

            $accountRoleBefore = $currentAccountRole?->role->value;

            if ($accountRole === null) {
                $currentAccountRole?->delete();
                $this->logAccountRoleChange($account, $actor, $staff, $accountRoleBefore, null);

                return $this->loadStaffRelations($staff, $account);
            }

            AccountUserRole::query()->updateOrCreate(
                [
                    'account_id' => $account->id,
                    'user_id' => $staff->id,
                ],
                ['role' => AccountRole::from($accountRole)],
            );

            $this->logAccountRoleChange($account, $actor, $staff, $accountRoleBefore, $accountRole);

            return $this->loadStaffRelations($staff, $account);
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

    private function wouldRemoveOnlyActorAdmin(
        Account $account,
        User $actor,
        User $staff,
        ?string $accountRole,
        ?AccountUserRole $currentAccountRole,
    ): bool {
        if ($accountRole !== null || $actor->id !== $staff->id) {
            return false;
        }

        if (! $currentAccountRole instanceof AccountUserRole || $currentAccountRole->role !== AccountRole::AccountAdmin) {
            return false;
        }

        return ! AccountUserRole::query()
            ->where('account_id', $account->id)
            ->where('role', AccountRole::AccountAdmin->value)
            ->where('user_id', '!=', $actor->id)
            ->exists();
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
}
