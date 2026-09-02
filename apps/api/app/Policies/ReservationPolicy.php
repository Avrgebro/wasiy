<?php

namespace App\Policies;

use App\Enums\AccountRole;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class ReservationPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * Mirrors AmenityPolicy: admins and assigned staff see the surface;
     * Front Desk may view but only managers (and admins) create and decide.
     * canManageRegistry() already refuses deactivated Locations.
     */
    public function viewAny(User $user, Location $location): bool
    {
        return $this->isAccountAdmin($user, $location)
            || $this->access->canViewRegistry($user, $location);
    }

    public function view(User $user, Reservation $reservation): bool
    {
        return $this->viewAny($user, $reservation->location);
    }

    public function create(User $user, Location $location): bool
    {
        // Front desk registers bookings for residents at the counter, so
        // create follows view access, not manage.
        return $this->access->canViewRegistry($user, $location);
    }

    public function decide(User $user, Reservation $reservation): bool
    {
        return $this->access->canManageRegistry($user, $reservation->location);
    }

    public function cancel(User $user, Reservation $reservation): bool
    {
        return $this->access->canViewRegistry($user, $reservation->location);
    }

    private function isAccountAdmin(User $user, Location $location): bool
    {
        return $this->access->hasAccountRole($user, $location->account, AccountRole::AccountAdmin);
    }
}
