<?php

namespace App\Policies;

use App\Models\Location;
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
        return $this->access->canManageRegistry($user, $location);
    }

    public function update(User $user, UnitMembership $unitMembership): bool
    {
        return $this->access->canManageRegistry($user, $unitMembership->location);
    }

    public function delete(User $user, UnitMembership $unitMembership): bool
    {
        return $this->access->canManageRegistry($user, $unitMembership->location);
    }
}
