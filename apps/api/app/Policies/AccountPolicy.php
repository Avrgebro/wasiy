<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class AccountPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function view(User $user, Account $account): bool
    {
        return $this->access->canAccessAccount($user, $account);
    }

    public function manageStaff(User $user, Account $account): bool
    {
        return $this->access->canManageStaff($user, $account);
    }

    /**
     * Account-level operational settings are the defaults every Location
     * inherits, so writing them is Account Admin only.
     */
    public function manageSettings(User $user, Account $account): bool
    {
        return $this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin);
    }
}
