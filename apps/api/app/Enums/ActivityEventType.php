<?php

namespace App\Enums;

enum ActivityEventType: string
{
    case StaffInvited = 'staff.invited';
    case StaffRoleAssigned = 'staff.role_assigned';
    case StaffRoleRemoved = 'staff.role_removed';
    case StaffLocationsChanged = 'staff.locations_changed';
    case UnitCreated = 'unit.created';
    case UnitUpdated = 'unit.updated';
    case UnitInactivated = 'unit.inactivated';
    case ResidentCreated = 'resident.created';
    case ResidentUpdated = 'resident.updated';
    case ResidentInactivated = 'resident.inactivated';
    case ResidentInvited = 'resident.invited';
    case ResidentClaimed = 'resident.claimed';
    case ResidentPhoneUpdated = 'resident.phone_updated';
    case UnitMembershipCreated = 'unit_membership.created';
    case UnitMembershipUpdated = 'unit_membership.updated';
    case UnitMembershipInactivated = 'unit_membership.inactivated';
    case UnitMembershipPrimaryContactChanged = 'unit_membership.primary_contact_changed';
    case VehicleCreated = 'vehicle.created';
    case VehicleUpdated = 'vehicle.updated';
    case VehicleDeleted = 'vehicle.deleted';
    case VehicleInactivated = 'vehicle.inactivated';
    case ExportRequested = 'export.requested';
    case ExportCompleted = 'export.completed';
    case ExportFailed = 'export.failed';
}
