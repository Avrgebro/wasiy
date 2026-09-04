<?php

namespace App\Policies;

use App\Enums\Capability;
use App\Models\Location;
use App\Models\Package;
use App\Models\User;
use App\Services\AccessAuthorizationService;

/**
 * The desk's log: every staff role on the location registers and delivers.
 * ManageReception covers admins, managers and front desk.
 */
class PackagePolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageReception);
    }

    public function view(User $user, Package $package): bool
    {
        return $this->access->can($user, $package->location, Capability::ManageReception);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->can($user, $location, Capability::ManageReception);
    }

    public function deliver(User $user, Package $package): bool
    {
        return $this->access->can($user, $package->location, Capability::ManageReception);
    }
}
