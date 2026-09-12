<?php

namespace App\Enums;

use Carbon\CarbonInterface;

/**
 * The keys an Amenity's `open_days` holds (ADR 0043), in calendar order.
 */
enum Weekday: string
{
    case Monday = 'monday';
    case Tuesday = 'tuesday';
    case Wednesday = 'wednesday';
    case Thursday = 'thursday';
    case Friday = 'friday';
    case Saturday = 'saturday';
    case Sunday = 'sunday';

    public static function of(CarbonInterface $day): self
    {
        return self::from(strtolower($day->englishDayOfWeek));
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_map(fn (self $day): string => $day->value, self::cases());
    }
}
