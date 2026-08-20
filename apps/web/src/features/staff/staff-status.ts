import type { StaffSummary } from './api'

export type StaffStatus = 'active' | 'deactivated' | 'unassigned'

export function staffStatus(staff: StaffSummary): StaffStatus {
  if (staff.deactivated_at) {
    return 'deactivated'
  }

  if (staff.account_role === null && staff.location_assignments.length === 0) {
    return 'unassigned'
  }

  return 'active'
}

/** Deactivated people stay listed but visually recede, per the design. */
export function staffRowClassName(staff: StaffSummary) {
  return staffStatus(staff) === 'deactivated' ? 'opacity-60' : undefined
}
