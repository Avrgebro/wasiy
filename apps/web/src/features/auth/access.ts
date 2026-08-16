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

const roleLabelKeys: Record<string, string> = {
  [accountRoles.accountAdmin]: 'roles.accountAdmin',
  [locationRoles.locationManager]: 'roles.locationManager',
  [locationRoles.frontDesk]: 'roles.frontDesk',
}

/**
 * Map an API role value onto its i18n key. Role values are snake_case on the
 * wire and camelCase in the locale files.
 */
export function getRoleLabelKey(role: string) {
  return roleLabelKeys[role] ?? role
}

/**
 * Manager and above: every staff role except front desk. Gates the
 * registry-mutating actions and the location entries front desk must not see.
 * Currently identical to canAccessAdmin, and will diverge from it the moment
 * front desk joins this surface.
 */
export function canManageRegistry(me: MeResponse) {
  return (
    hasAccountRole(me, accountRoles.accountAdmin) ||
    hasLocationRole(me, locationRoles.locationManager)
  )
}

export function canAccessAdmin(me: MeResponse) {
  return (
    hasAccountRole(me, accountRoles.accountAdmin) ||
    hasLocationRole(me, locationRoles.locationManager)
  )
}

export function canAccessFrontDesk(me: MeResponse) {
  return hasLocationRole(me, locationRoles.frontDesk)
}

export function canAccessPortal(me: MeResponse) {
  return me.resident_memberships.length > 0
}

export function canAccessAnySurface(me: MeResponse) {
  return canAccessAdmin(me) || canAccessFrontDesk(me) || canAccessPortal(me)
}

export function getDefaultLocation(me: MeResponse) {
  return me.active_location
}

export function requiresAccountSelection(me: MeResponse) {
  return me.accounts.length > 1 && me.active_account === null
}

export function getDefaultAuthenticatedRoute(me: MeResponse) {
  if (requiresAccountSelection(me)) {
    return '/select-account' as const
  }

  if (canAccessAdmin(me)) {
    return '/admin' as const
  }

  if (canAccessFrontDesk(me)) {
    return '/front-desk' as const
  }

  if (canAccessPortal(me)) {
    return '/portal' as const
  }

  return '/no-access' as const
}


/**
 * Account-wide administration rights. Exported so route guards enforce exactly
 * what the sidebar gates on — hiding an entry is not enforcement on its own.
 */
export function isAccountAdmin(me: MeResponse) {
  return hasAccountRole(me, accountRoles.accountAdmin)
}

export type Surface = 'admin' | 'front-desk' | 'portal'

/**
 * The single map from surface to its access predicate. Route guards are the
 * only enforcement point; navigation lookups below assume access was already
 * checked.
 */
export const surfaceAccess: Record<Surface, (me: MeResponse) => boolean> = {
  admin: canAccessAdmin,
  'front-desk': canAccessFrontDesk,
  portal: canAccessPortal,
}
