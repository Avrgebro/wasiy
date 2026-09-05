<?php

namespace App\Policies;

use App\Models\ResidentAlert;
use App\Models\Unit;
use App\Models\User;
use App\Services\AccessAuthorizationService;

/** Alerts are personal: a member of the unit lists them, only their owner marks them. */
class ResidentAlertPolicy
{
    public function __construct(
        private readonly AccessAuthorizationService $access,
    ) {}

    public function viewAsResident(User $user, Unit $unit): bool
    {
        return $this->access->canResidentAccessUnit($user, $unit);
    }

    public function markRead(User $user, ResidentAlert $alert): bool
    {
        return $alert->resident?->user_id === $user->id;
    }
}
