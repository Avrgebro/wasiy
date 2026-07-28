import {
  Buildings2,
  Calendar,
  ClipboardList,
  KeySquare,
  Magnifier,
  Settings,
  Speaker,
  UserCheckRounded,
  UsersGroupRounded,
  Wallet,
  Widget,
} from '@solar-icons/react'
import type {
  LayoutNavCollapsible,
  LayoutNavEntry,
  LayoutNavGroup,
  LayoutNavItem,
  LayoutNavLeaf,
} from '../../components/layout/shared/types'
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
 * Navigation is declared once as a spec tree; each entry decides for itself who
 * may see it. Filtering happens at render, so adding a role means adding a
 * predicate rather than another hand-maintained copy of the whole menu.
 */
type NavPredicate = (me: MeResponse) => boolean

type NavLeafSpec = LayoutNavLeaf & { visibleTo?: NavPredicate }

type NavCollapsibleSpec = Omit<LayoutNavCollapsible, 'children'> & {
  children: NavLeafSpec[]
  visibleTo?: NavPredicate
}

type NavItemSpec = NavLeafSpec | NavCollapsibleSpec

type NavGroupSpec = Omit<LayoutNavGroup, 'items'> & {
  items: NavItemSpec[]
  visibleTo?: NavPredicate
}

export type NavEntrySpec = NavItemSpec | NavGroupSpec

function isVisible(spec: { visibleTo?: NavPredicate }, me: MeResponse) {
  return spec.visibleTo?.(me) ?? true
}

function isCollapsible(item: NavItemSpec): item is NavCollapsibleSpec {
  return item.type === 'collapsible'
}

function isGroup(entry: NavEntrySpec): entry is NavGroupSpec {
  return entry.type === 'group'
}

function filterNavigationItems(
  items: NavItemSpec[],
  me: MeResponse,
): LayoutNavItem[] {
  return items.flatMap((item): LayoutNavItem[] => {
    if (!isVisible(item, me)) {
      return []
    }

    if (!isCollapsible(item)) {
      return [item]
    }

    const children = item.children.filter((child) => isVisible(child, me))

    // A collapsible that expands to nothing is noise.
    return children.length > 0 ? [{ ...item, children }] : []
  })
}

export function filterNavigationEntries(
  entries: NavEntrySpec[],
  me: MeResponse,
): LayoutNavEntry[] {
  return entries.flatMap((entry): LayoutNavEntry[] => {
    if (!isVisible(entry, me)) {
      return []
    }

    if (!isGroup(entry)) {
      return filterNavigationItems([entry], me)
    }

    const items = filterNavigationItems(entry.items, me)

    // An empty section renders nothing rather than an orphan heading.
    return items.length > 0 ? [{ ...entry, items }] : []
  })
}

/**
 * Account-wide administration rights. Exported so route guards enforce exactly
 * what the sidebar gates on — hiding an entry is not enforcement on its own.
 */
export function isAccountAdmin(me: MeResponse) {
  return hasAccountRole(me, accountRoles.accountAdmin)
}

/**
 * Everything scoped to the currently selected Location. Visible to any staff
 * role that reaches this surface; the manage-only entries carry their own
 * predicate so front desk keeps the read-only subset when it joins here.
 */
const locationNavigationGroup: NavGroupSpec = {
  type: 'group',
  titleKey: 'navGroups.location',
  items: [
    { icon: Widget, labelKey: 'nav.dashboard', to: '/admin' },
    {
      type: 'collapsible',
      icon: UsersGroupRounded,
      labelKey: 'nav.people',
      children: [
        {
          icon: UserCheckRounded,
          labelKey: 'nav.residents',
          to: '/admin/registry/residents',
        },
        { icon: Magnifier, labelKey: 'nav.visitors', to: '/admin/visitors' },
      ],
    },
    { icon: Buildings2, labelKey: 'nav.units', to: '/admin/registry/units' },
    { icon: KeySquare, labelKey: 'nav.vehicles', to: '/admin/registry/vehicles' },
    {
      icon: Calendar,
      labelKey: 'nav.reservations',
      to: '/admin/reservations',
    },
    {
      icon: Speaker,
      labelKey: 'nav.announcements',
      to: '/admin/announcements',
      visibleTo: canManageRegistry,
    },
    {
      icon: Wallet,
      labelKey: 'nav.finances',
      to: '/admin/finances',
      visibleTo: canManageRegistry,
    },
  ],
}

/**
 * Account-wide administration, scoped above any single Location.
 */
const administrationNavigationGroup: NavGroupSpec = {
  type: 'group',
  titleKey: 'navGroups.administration',
  visibleTo: isAccountAdmin,
  items: [
    { icon: Buildings2, labelKey: 'nav.locations', to: '/admin/locations' },
    { icon: UsersGroupRounded, labelKey: 'nav.staff', to: '/admin/staff' },
    { icon: ClipboardList, labelKey: 'nav.activity', to: '/admin/activity' },
    { icon: Settings, labelKey: 'nav.settings', to: '/admin/settings' },
  ],
}

const adminSurfaceNavigation: NavEntrySpec[] = [
  locationNavigationGroup,
  administrationNavigationGroup,
]

const frontDeskNavigation: NavEntrySpec[] = [
  {
    type: 'group',
    titleKey: 'navGroups.frontDesk',
    items: [{ icon: UserCheckRounded, labelKey: 'nav.checkIn', to: '/front-desk' }],
  },
]

const portalNavigation: NavEntrySpec[] = [
  {
    type: 'group',
    titleKey: 'navGroups.portal',
    items: [{ icon: Widget, labelKey: 'nav.home', to: '/portal' }],
  },
]

export function getAvailableNavigationItems(
  me: MeResponse,
  surface: 'admin' | 'front-desk' | 'portal',
): LayoutNavEntry[] {
  if (surface === 'admin') {
    return canAccessAdmin(me)
      ? filterNavigationEntries(adminSurfaceNavigation, me)
      : []
  }

  if (surface === 'front-desk') {
    return canAccessFrontDesk(me)
      ? filterNavigationEntries(frontDeskNavigation, me)
      : []
  }

  return canAccessPortal(me) ? filterNavigationEntries(portalNavigation, me) : []
}
