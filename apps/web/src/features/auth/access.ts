import type { LocationRole, MeResponse } from './types'

export const accountRoles = {
  accountAdmin: 'account_admin',
} as const

export const locationRoles = {
  frontDesk: 'front_desk',
  locationManager: 'location_manager',
} as const satisfies Record<string, LocationRole>

export function hasAccountRole(
  me: MeResponse,
  role: (typeof accountRoles)[keyof typeof accountRoles],
) {
  return me.roles.account.some((assignment) => assignment.role === role)
}

export function hasLocationRole(me: MeResponse, role: LocationRole) {
  return me.roles.location.some((assignment) => assignment.role === role)
}

export function canAccessAdmin(me: MeResponse) {
  return (
    hasAccountRole(me, accountRoles.accountAdmin) ||
    hasLocationRole(me, locationRoles.locationManager)
  )
}

export function getDefaultLocation(me: MeResponse) {
  return me.assigned_locations[0] ?? null
}

export function getDefaultAuthenticatedRoute(me: MeResponse) {
  if (canAccessAdmin(me)) {
    return '/admin' as const
  }

  return '/portal' as const
}
