<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Location;
use App\Models\Reservation;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class ReservationPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * Capabilities decide who sees, requests and decides (ADR 0036); the
     * access service already refuses deactivated Locations.
     */
    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ViewReservations);
    }

    public function view(User $user, Reservation $reservation): bool
    {
        return $this->viewAny($user, $reservation->location);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::CreateReservations);
    }

    public function decide(User $user, Reservation $reservation): bool
    {
        return $this->access->can($user, $reservation->location, Capability::DecideReservations);
    }

    public function cancel(User $user, Reservation $reservation): bool
    {
        return $this->access->can($user, $reservation->location, Capability::CreateReservations);
    }

    /** Portal: any member of the unit reads, requests and cancels its bookings (roadmap P2). */
    public function viewAsResident(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    public function createAsResident(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    public function cancelAsResident(User $user, Reservation $reservation): bool
    {
        return $reservation->unit !== null && $this->access->canResidentAccessUnit($user, $reservation->unit);
    }
}
