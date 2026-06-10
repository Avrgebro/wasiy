<?php

namespace App\Policies;

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
}
