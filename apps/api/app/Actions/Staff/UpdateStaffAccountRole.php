<?php

namespace App\Actions\Staff;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\AccountUserRole;
use App\Models\LocationUserRole;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateStaffAccountRole
{
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

            if ($accountRole === null) {
                $currentAccountRole?->delete();

                return $this->loadStaffRelations($staff, $account);
            }

            AccountUserRole::query()->updateOrCreate(
                [
                    'account_id' => $account->id,
                    'user_id' => $staff->id,
                ],
                ['role' => AccountRole::from($accountRole)],
            );

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
}
