<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Location;
use App\Models\Unit;
use App\Models\UnitMembership;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class UnitMembershipPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageRegistry);
    }

    public function update(User $user, UnitMembership $unitMembership): bool
    {
        return $this->access->can($user, $unitMembership->location, Capability::ManageRegistry);
    }

    public function delete(User $user, UnitMembership $unitMembership): bool
    {
        return $this->access->can($user, $unitMembership->location, Capability::ManageRegistry);
    }

    /** Every member reads Mi hogar. */
    public function viewHousehold(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    /** Only the primary contact adds, removes and re-invites (portal P4). */
    public function manageHousehold(User $user, Unit $unit): bool
    {
        return $this->access->isPrimaryContactOf($user, $unit);
    }
}
