<?php

namespace App\Enums;

enum MovementCategory: string
{
    case ReservationFee = 'reservation_fee';
    case ReservationDeposit = 'reservation_deposit';
    case Utility = 'utility';
    case Cleaning = 'cleaning';
    case Maintenance = 'maintenance';
    case Other = 'other';

    /**
     * Deposits are money held in guarantee, not income: they follow their
     * own status path and never count toward the income total.
     */
    public function isDeposit(): bool
    {
        return $this === self::ReservationDeposit;
    }
}
