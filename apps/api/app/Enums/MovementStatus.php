<?php

namespace App\Enums;

enum MovementStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Held = 'held';
    case Refunded = 'refunded';
    case Retained = 'retained';
    case Voided = 'voided';

    /**
     * The whole status machine in one place (ADR 0034, revised 2026-09-11).
     * Statuses move forward and the only fix for a mistake is one step back:
     * fees and expenses go pending → paid; deposits go pending → held and
     * then refunded or retained. Void is available until money leaves
     * (pending, paid, held). Refunded and voided are terminal. Each settled,
     * non-terminal status keeps exactly one undo (paid → pending,
     * held → pending, retained → held) because reservation and dues rows
     * cannot be recorded again once voided.
     *
     * @return list<self>
     */
    public function transitionsFor(MovementCategory $category): array
    {
        if ($category->isDeposit()) {
            return match ($this) {
                self::Pending => [self::Held, self::Voided],
                self::Held => [self::Refunded, self::Retained, self::Voided, self::Pending],
                self::Retained => [self::Held],
                default => [],
            };
        }

        return match ($this) {
            self::Pending => [self::Paid, self::Voided],
            self::Paid => [self::Voided, self::Pending],
            default => [],
        };
    }

    /** The single step back a status offers, if any. */
    public function undo(MovementCategory $category): ?self
    {
        return match ($this) {
            self::Paid, self::Held => self::Pending,
            self::Retained => $category->isDeposit() ? self::Held : null,
            default => null,
        };
    }

    public function canTransitionTo(self $target, MovementCategory $category): bool
    {
        return in_array($target, $this->transitionsFor($category), true);
    }

    /**
     * Initial statuses a manual record may start in.
     *
     * @return list<self>
     */
    public static function initialFor(MovementCategory $category): array
    {
        return $category->isDeposit()
            ? [self::Pending, self::Held]
            : [self::Pending, self::Paid];
    }
}
