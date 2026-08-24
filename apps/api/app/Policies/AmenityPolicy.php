<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Amenity;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class AmenityPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * An Account Admin or a Location Manager assigned to the Location may
     * manage Amenities; Front Desk may only view. canManageRegistry()
     * already refuses deactivated Locations, so a retired property's
     * Amenities are read-only for everyone.
     */
    public function viewAny(User $user, Location $location): bool
    {
        return $this->isAccountAdmin($user, $location)
            || $this->access->canViewRegistry($user, $location);
    }

    public function view(User $user, Amenity $amenity): bool
    {
        return $this->viewAny($user, $amenity->location);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->canManageRegistry($user, $location);
    }

    public function update(User $user, Amenity $amenity): bool
    {
        return ! $amenity->isDeactivated()
            && $this->access->canManageRegistry($user, $amenity->location);
    }

    public function deactivate(User $user, Amenity $amenity): bool
    {
        return ! $amenity->isDeactivated()
            && $this->access->canManageRegistry($user, $amenity->location);
    }

    public function reactivate(User $user, Amenity $amenity): bool
    {
        return $amenity->isDeactivated()
            && $this->access->canManageRegistry($user, $amenity->location);
    }

    /**
     * The admin Location surface shows a deactivated Location's Amenities
     * read-only even though operational access is gone.
     */
    private function isAccountAdmin(User $user, Location $location): bool
    {
        return $this->access->hasAccountRole($user, $location->account, AccountRole::AccountAdmin);
    }
}
