<?php

namespace App\Enums;

enum MovementCategory: string
{
    // Income
    case ReservationFee = 'reservation_fee';
    case ReservationDeposit = 'reservation_deposit';
    case MaintenanceDues = 'maintenance_dues';
    case Fine = 'fine';
    case OtherIncome = 'other_income';

    // Expense
    case Water = 'water';
    case Electricity = 'electricity';
    case Gas = 'gas';
    case Telecom = 'telecom';
    case Cleaning = 'cleaning';
    case Maintenance = 'maintenance';
    case Security = 'security';
    case Staff = 'staff';
    case Supplies = 'supplies';
    case Gardening = 'gardening';
    case InsuranceTaxes = 'insurance_taxes';
    case Administration = 'administration';
    case OtherExpense = 'other_expense';

    /**
     * Categories are closed and direction-scoped (mockup 10, "Categorías v2"):
     * a fine is always income, water is always an expense.
     */
    public function direction(): MovementDirection
    {
        return match ($this) {
            self::ReservationFee, self::ReservationDeposit, self::MaintenanceDues, self::Fine, self::OtherIncome => MovementDirection::Income,
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
