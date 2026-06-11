<?php

namespace App\Enums;

enum ActivityEventType: string
{
    case StaffInvited = 'staff.invited';
    case StaffRoleAssigned = 'staff.role_assigned';
    case StaffRoleRemoved = 'staff.role_removed';
    case StaffLocationsChanged = 'staff.locations_changed';
}
