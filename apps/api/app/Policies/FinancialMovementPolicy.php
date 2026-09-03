<?php

namespace App\Policies;

use App\Models\FinancialMovement;
use App\Models\Location;
use App\Models\User;
use App\Services\AccessAuthorizationService;

class FinancialMovementPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    /**
     * Finances are a manager surface: Front Desk never sees the ledger.
     * canManageRegistry() covers admins and refuses deactivated Locations.
     */
    public function viewAny(User $user, Location $location): bool
    {
        return $this->access->canManageRegistry($user, $location);
    }

    public function view(User $user, FinancialMovement $movement): bool
    {
        return $this->viewAny($user, $movement->location);
    }

    public function create(User $user, Location $location): bool
    {
        return $this->access->canManageRegistry($user, $location);
    }

    public function manage(User $user, FinancialMovement $movement): bool
    {
        return $this->access->canManageRegistry($user, $movement->location);
    }
}
