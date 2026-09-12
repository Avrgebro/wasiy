<?php

namespace App\Enums;

enum MovementCategory: string
{
    // Income
    case ReservationFee = 'reservation_fee';
    case ReservationDeposit = 'reservation_deposit';
    case MaintenanceDues = 'maintenance_dues';
    case OtherIncome = 'other_income';

    // Expense
    case Services = 'services';
    case Staff = 'staff';
    case Maintenance = 'maintenance';
    case Administration = 'administration';
    case OtherExpense = 'other_expense';

    /**
     * Categories are closed and direction-scoped: nine buckets the way a
     * condominio budget is presented (ADR 0034, revised 2026-09-11). The
     * line item (Luz, Sedapal, multa por ruido) lives in concept and
     * counterparty, not in the category.
     */
    public function direction(): MovementDirection
    {
        return match ($this) {
            self::ReservationFee, self::ReservationDeposit, self::MaintenanceDues, self::OtherIncome => MovementDirection::Income,
            default => MovementDirection::Expense,
        };
    }

    /**
     * @return list<self>
     */
    public static function forDirection(MovementDirection $direction): array
    {
        return array_values(array_filter(self::cases(), fn (self $category): bool => $category->direction() === $direction));
    }

    /**
     * Deposits are money held in guarantee, not income: they follow their
     * own status path and never count toward the income total.
     */
    public function isDeposit(): bool
    {
        return $this === self::ReservationDeposit;
    }
}
