<?php

namespace App\Enums;

/** How the desk confirmed a visitor. Informational; never blocks check-in. */
enum VisitConfirmation: string
{
    case None = 'none';
    case Intercom = 'intercom';
    case Phone = 'phone';
    case Management = 'management';
}
