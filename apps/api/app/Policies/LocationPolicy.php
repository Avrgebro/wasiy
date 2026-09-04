<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Enums\Capability;
use App\Models\Account;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class LocationPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * The Locations admin surface lists every Location in the Account,
     * including deactivated ones, so it is Account Admin only. Managers see
     * their own Locations through accessible_locations on /me.
     */
    public function viewAny(User $user, Account $account): bool
    {
        return $this->isAccountAdmin($user, $account);
    }

    /**
     * Operational access excludes deactivated Locations, but the Account
     * Admin surface must still show a deactivated Location read-only (its
     * detail page carries the reactivate action).
     */
    public function view(User $user, Location $location): bool
    {
        return $this->isAccountAdmin($user, $location->account)
            || $this->access->canAccessLocation($user, $location);
    }

    public function create(User $user, Account $account): bool
    {
        return $this->isAccountAdmin($user, $account);
    }

    /**
     * Identity belongs to the Account Admin, and a deactivated Location is
     * read-only until reactivated.
     */
    public function update(User $user, Location $location): bool
    {
        return ! $location->isDeactivated()
            && $this->isAccountAdmin($user, $location->account);
    }

    public function deactivate(User $user, Location $location): bool
    {
        return ! $location->isDeactivated()
            && $this->isAccountAdmin($user, $location->account);
    }

    public function reactivate(User $user, Location $location): bool
    {
        return $location->isDeactivated()
            && $this->isAccountAdmin($user, $location->account);
    }

    public function viewSettings(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageLocationSettings);
    }

    /**
     * A Location Manager may tune how an assigned Location operates without
     * owning its identity — mirroring the staff rule that only the Account
     * Admin creates staff or changes roles. The access service refuses
     * deactivated Locations for admins and managers alike.
     */
    public function updateSettings(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageLocationSettings);
    }

    private function isAccountAdmin(User $user, Account $account): bool
    {
        return $this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin);
    }
}
