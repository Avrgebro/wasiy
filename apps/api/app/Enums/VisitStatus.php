<?php

namespace App\Enums;

enum VisitStatus: string
{
    /** Pre-registered by a resident; not yet at the desk. */
    case Expected = 'expected';
    case Inside = 'inside';
    case Left = 'left';
    /** A pre-registration the resident withdrew. */
    case Cancelled = 'cancelled';
}
