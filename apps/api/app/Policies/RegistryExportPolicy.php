<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\RegistryExport;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class RegistryExportPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function viewAny(User $user, Account $account): bool
    {
        return $this->access->canAccessAccount($user, $account);
    }

    public function create(User $user, Account $account, ?Location $location): bool
    {
        if (! $this->access->canAccessAccount($user, $account)) {
            return false;
        }

        if ($this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            return $location === null || $location->account_id === $account->id;
        }

        return $location !== null
            && $location->account_id === $account->id
            && $this->access->canManageRegistry($user, $location);
    }

    public function view(User $user, RegistryExport $export): bool
    {
        if ($this->access->hasAccountRole($user, $export->account, AccountRole::AccountAdmin)) {
            return true;
        }

        return $export->location !== null
            && $this->access->canManageRegistry($user, $export->location);
    }

    public function download(User $user, RegistryExport $export): bool
    {
        return $this->view($user, $export);
    }
}
