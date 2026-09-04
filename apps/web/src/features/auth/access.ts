import type { Capability, LocationRole, MeResponse } from './types'

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
 * The one location-scoped permission check. Reads the capabilities the API
 * computed for the active Location (ADR 0036), so a manager of Torre Norte
 * browsing Edificio Central as front desk sees the desk's UI, not the
 * manager's. No active Location means no location capability.
 */
export function can(me: MeResponse, capability: Capability) {
  return me.active_location?.capabilities.includes(capability) ?? false
}

/** A predicate for nav `visibleTo` and route guards: `hasCapability('finances.manage')`. */
export function hasCapability(capability: Capability) {
  return (me: MeResponse) => can(me, capability)
}

/** The matrix rows, mirrored from the API's Capability::forRoles() for fixtures and stories. */
export const FRONT_DESK_CAPABILITIES: Capability[] = ['registry.view', 'reception.manage', 'reservations.view']
export const MANAGER_CAPABILITIES: Capability[] = [
  ...FRONT_DESK_CAPABILITIES,
  'registry.manage',
  'reservations.create',
  'reservations.decide',
  'finances.manage',
  'announcements.manage',
  'location.settings',
]
export const ADMIN_CAPABILITIES: Capability[] = [...MANAGER_CAPABILITIES, 'account.manage']

/**
 * Every staff role shares the admin surface; front desk sees the read-only
 * subset through the navigation predicates and the pages' manage checks, and
 * the API policies enforce the same line. There is no separate front-desk
 * shell.
 */
export function canAccessAdmin(me: MeResponse) {
  return (
    hasAccountRole(me, accountRoles.accountAdmin) ||
    hasLocationRole(me, locationRoles.locationManager) ||
    hasLocationRole(me, locationRoles.frontDesk)
  )
}

export function canAccessPortal(me: MeResponse) {
  return me.resident_memberships.length > 0
}

export function canAccessAnySurface(me: MeResponse) {
  return canAccessAdmin(me) || canAccessPortal(me)
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

export type Surface = 'admin' | 'portal'

/**
 * The single map from surface to its access predicate. Route guards are the
 * only enforcement point; navigation lookups below assume access was already
 * checked.
 */
export const surfaceAccess: Record<Surface, (me: MeResponse) => boolean> = {
  admin: canAccessAdmin,
  portal: canAccessPortal,
}
