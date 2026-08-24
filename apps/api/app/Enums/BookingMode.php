<?php

namespace App\Enums;

enum BookingMode: string
{
    case Instant = 'instant';
    case Approval = 'approval';
}
