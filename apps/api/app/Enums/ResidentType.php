<?php

namespace App\Enums;

enum ResidentType: string
{
    case Owner = 'owner';
    case Tenant = 'tenant';
    case Occupant = 'occupant';
    case GuestResident = 'guest_resident';
}
