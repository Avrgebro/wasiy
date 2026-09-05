<?php

namespace App\Enums;

/** How the desk confirmed a visitor. Informational; never blocks check-in. */
enum VisitConfirmation: string
{
    case None = 'none';
    case Intercom = 'intercom';
    case Phone = 'phone';
    /** The resident announced the visit from the portal; fixed on arrival. */
    case PreRegistered = 'pre_registered';
    case Management = 'management';
}
