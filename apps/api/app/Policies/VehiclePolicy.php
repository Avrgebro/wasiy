<?php

namespace App\Policies;

use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\AccessAuthorizationService;

class VehiclePolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function view(User $user, Vehicle $vehicle): bool
    {
        return $this->access->canViewRegistry($user, $vehicle->location)
            || $this->access->canResidentManageVehicle($user, $vehicle);
    }

    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->canViewRegistry($user, $location);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->canManageRegistry($user, $location);
    }

    public function update(User $user, Vehicle $vehicle): bool
    {
        return $this->access->canManageVehicle($user, $vehicle);
    }

    public function delete(User $user, Vehicle $vehicle): bool
    {
        return $this->access->canManageVehicle($user, $vehicle);
    }

    /**
     * Portal-only abilities. Kept separate from update/delete so residents
     * cannot reach the staff endpoints, which allow setting status and
     * reassigning a vehicle to any unit in the location.
     */
    public function createAsResident(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    public function updateAsResident(User $user, Vehicle $vehicle): bool
    {
        return $this->access->canResidentManageVehicle($user, $vehicle);
    }

    public function deleteAsResident(User $user, Vehicle $vehicle): bool
    {
        return $this->access->canResidentManageVehicle($user, $vehicle);
    }
}
