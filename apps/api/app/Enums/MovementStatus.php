<?php

namespace App\Enums;

enum MovementStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Held = 'held';
    case ToRefund = 'to_refund';
    case Refunded = 'refunded';
    case Retained = 'retained';
    case Voided = 'voided';

    /**
     * The whole status machine in one place. Fees and expenses go
     * pending → paid (reversible for mistakes); deposits go
     * pending → held → to_refund → refunded, with retained (kept for
     * damages) reachable once the money is in hand and reversible back to
     * held. Any pending row can be voided.
     *
     * @return list<self>
     */
    public function transitionsFor(MovementCategory $category): array
    {
        if ($category->isDeposit()) {
            return match ($this) {
                self::Pending => [self::Held, self::Voided],
                self::Held => [self::ToRefund, self::Retained, self::Pending],
                self::ToRefund => [self::Refunded, self::Retained, self::Held],
                // Kept for damages is a judgment call, so it stays reversible;
                // refunded and voided are not, because money moved or the row
                // never counted.
                self::Retained => [self::Held],
                default => [],
            };
        }

        return match ($this) {
            self::Pending => [self::Paid, self::Voided],
            self::Paid => [self::Pending],
            default => [],
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
