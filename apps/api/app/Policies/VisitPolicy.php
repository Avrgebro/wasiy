<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Location;
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
}
