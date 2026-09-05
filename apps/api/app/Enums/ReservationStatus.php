<?php

namespace App\Enums;

enum ReservationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Observed = 'observed';
    case Cancelled = 'cancelled';

    /**
     * Only approval holds capacity: pending/observed requests never block a
     * slot, so the approver resolves contention. "Completada" in the UI is
     * derived (approved + ended), never stored.
     */
    public function holdsCapacity(): bool
    {
        return $this === self::Approved;
    }

    public function isDecided(): bool
    {
        return in_array($this, [self::Approved, self::Rejected, self::Cancelled], true);
    }
}
