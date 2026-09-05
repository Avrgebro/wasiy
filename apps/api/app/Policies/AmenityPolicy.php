<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Enums\Capability;
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
     * manage Amenities; Front Desk may only view. The access service
     * refuses deactivated Locations, so a retired property's Amenities are
     * read-only for everyone.
     */
    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ViewReservations);
    }

    public function view(User $user, Amenity $amenity): bool
    {
        return $this->viewAny($user, $amenity->location);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::DecideReservations);
    }

    public function update(User $user, Amenity $amenity): bool
    {
        return ! $amenity->isDeactivated()
            && $this->access->can($user, $amenity->location, Capability::DecideReservations);
    }

    public function deactivate(User $user, Amenity $amenity): bool
    {
        return ! $amenity->isDeactivated()
            && $this->access->can($user, $amenity->location, Capability::DecideReservations);
    }

    public function reactivate(User $user, Amenity $amenity): bool
    {
        return $amenity->isDeactivated()
            && $this->access->can($user, $amenity->location, Capability::DecideReservations);
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
