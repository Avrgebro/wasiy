<?php

namespace App\Enums;

/** The four switches under "Notificaciones por correo". */
enum ResidentAlertFamily: string
{
    case Reservations = 'reservations';
    case Packages = 'packages';
    case Visitors = 'visitors';
    case Announcements = 'announcements';

    /** @return array<string, bool> */
    public static function allOn(): array
    {
        return array_fill_keys(array_map(fn (self $family) => $family->value, self::cases()), true);
    }
}
