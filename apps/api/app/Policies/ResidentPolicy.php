<?php

namespace App\Policies;

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
}
