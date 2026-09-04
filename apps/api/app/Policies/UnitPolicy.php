<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class UnitPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function view(User $user, Unit $unit): bool
    {
        return $this->access->can($user, $unit->location, Capability::ViewRegistry);
    }

    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ViewRegistry);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageRegistry);
    }

    public function update(User $user, Unit $unit): bool
    {
        return $this->access->canManageUnit($user, $unit);
    }

    public function delete(User $user, Unit $unit): bool
    {
        return $this->access->canManageUnit($user, $unit);
    }
}
