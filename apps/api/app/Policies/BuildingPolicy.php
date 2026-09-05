<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Building;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;

/**
 * Towers are Location structure (ADR 0037): anyone who reads the registry
 * sees them; changing them is a settings-level act.
 */
class BuildingPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ViewRegistry);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageLocationSettings);
    }

    public function update(User $user, Building $building): bool
    {
        return $this->access->can($user, $building->location, Capability::ManageLocationSettings);
    }

    public function delete(User $user, Building $building): bool
    {
        return $this->access->can($user, $building->location, Capability::ManageLocationSettings);
    }
}
