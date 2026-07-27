<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\RegistryImport;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class RegistryImportPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function viewAny(User $user, Account $account, ?Location $location = null): bool
    {
        if ($this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            return $location === null || $location->account_id === $account->id;
        }

        if ($location !== null) {
            return $location->account_id === $account->id
                && $this->access->canManageRegistry($user, $location);
        }

        return $this->access->accessibleLocationsForAccount($user, $account)
            ->get()
            ->contains(fn (Location $location): bool => $this->access->canManageRegistry($user, $location));
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->canManageRegistry($user, $location);
    }

    public function view(User $user, RegistryImport $import): bool
    {
        return $this->access->canManageRegistry($user, $import->location);
    }

    public function confirm(User $user, RegistryImport $import): bool
    {
        return $this->view($user, $import);
    }

    public function retry(User $user, RegistryImport $import): bool
    {
        return $this->view($user, $import);
    }
}
