<?php

namespace App\Enums;

/**
 * Derived, never stored: Programado until the fan-out runs, Vigente while it
 * shows in the portal, Vencido once expires_on has passed, Archivado when
 * staff pulled it. Importante is a flag that crosses all four.
 */
enum AnnouncementStatus: string
{
    case Scheduled = 'scheduled';
    case Active = 'active';
    case Expired = 'expired';
    case Archived = 'archived';
}
