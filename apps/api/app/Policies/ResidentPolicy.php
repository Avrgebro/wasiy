<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Account;
use App\Models\Location;
use App\Models\Resident;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class ResidentPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function create(User $user, Location $location): bool
    {
        return $this->access->canManageRegistry($user, $location);
    }

    public function createInAccount(User $user, Account $account): bool
    {
        return $this->access->canManageAnyRegistryInAccount($user, $account);
    }

    /**
     * Location-independent view access: admins of the resident's account,
     * or anyone with view access via one of the resident's membership
     * locations they can reach.
     */
    public function view(User $user, Resident $resident): bool
    {
        return $this->throughAnyAccessibleLocation(
            $user,
            $resident,
            fn (Location $location): bool => $this->viewInLocation($user, $resident, $location),
        );
    }

    public function update(User $user, Resident $resident): bool
    {
        return $this->throughAnyAccessibleLocation(
            $user,
            $resident,
            fn (Location $location): bool => $this->updateInLocation($user, $resident, $location),
        );
    }

    public function delete(User $user, Resident $resident): bool
    {
        return $this->throughAnyAccessibleLocation(
            $user,
            $resident,
            fn (Location $location): bool => $this->deleteInLocation($user, $resident, $location),
        );
    }

    public function viewInLocation(User $user, Resident $resident, Location $location): bool
    {
        return $this->access->canManageResidentInLocation($user, $resident, $location)
            || (
                $this->access->canViewRegistry($user, $location)
                && $resident->account_id === $location->account_id
                && $resident->unitMemberships()
                    ->where('location_id', $location->id)
                    ->where('account_id', $location->account_id)
                    ->exists()
            );
    }

    public function updateInLocation(User $user, Resident $resident, Location $location): bool
    {
        return $this->access->canManageResidentInLocation($user, $resident, $location);
    }

    public function deleteInLocation(User $user, Resident $resident, Location $location): bool
    {
        return $this->access->canManageResidentInLocation($user, $resident, $location);
    }

    public function updatePortalPhone(User $user, Resident $resident): bool
    {
        return $this->access->residentForUser($user)?->is($resident) === true;
    }

    /**
     * Admins of the resident's account pass outright; everyone else passes
     * when ANY membership location they can access satisfies the gate —
     * checking every candidate keeps the decision deterministic for staff
     * with different roles at different locations. A trashed account
     * (null relation) denies instead of erroring.
     *
     * @param  \Closure(Location): bool  $allows
     */
    private function throughAnyAccessibleLocation(User $user, Resident $resident, \Closure $allows): bool
    {
        $account = $resident->account;

        if ($account === null) {
            return false;
        }

        if ($this->access->hasAccountRole($user, $account, AccountRole::AccountAdmin)) {
            return true;
        }

        return $resident->unitMemberships()
            ->whereIn('location_id', $this->access->accessibleLocationsForAccount($user, $account)->pluck('id'))
            ->with('location')
            ->get()
            ->pluck('location')
            ->filter()
            ->contains(fn (Location $location): bool => $allows($location));
    }
}
