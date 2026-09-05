<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Models\Visit;
use App\Services\AccessAuthorizationService;

/** The desk's log: every staff role on the location registers and checks out. */
class VisitPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageReception);
    }

    public function view(User $user, Visit $visit): bool
    {
        return $this->access->can($user, $visit->location, Capability::ManageReception);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageReception);
    }

    public function checkOut(User $user, Visit $visit): bool
    {
        return $this->access->can($user, $visit->location, Capability::ManageReception);
    }

    public function confirmArrival(User $user, Visit $visit): bool
    {
        return $this->access->can($user, $visit->location, Capability::ManageReception);
    }

    /** Portal: a resident sees and announces visits for units they live in. */
    public function viewAsResident(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    public function preRegister(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    public function cancelAsResident(User $user, Visit $visit): bool
    {
        return $visit->unit !== null && $this->access->canResidentAccessUnit($user, $visit->unit);
    }
}
