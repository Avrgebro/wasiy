import {
  Buildings2,
  Calendar,
  ClipboardList,
  KeySquare,
  Magnifier,
  Speaker,
  UserCheckRounded,
  UsersGroupRounded,
  Widget,
} from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'
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

export function getAvailableNavigationItems(
  me: MeResponse,
  surface: 'admin' | 'front-desk' | 'portal',
): LayoutNavEntry[] {
  if (surface === 'admin') {
    if (hasAccountRole(me, accountRoles.accountAdmin)) {
      return accountAdminNavigationItems
    }

    if (hasLocationRole(me, locationRoles.locationManager)) {
      return locationManagerNavigationItems
    }

    return []
  }

  if (surface === 'front-desk') {
    return canAccessFrontDesk(me) ? frontDeskNavigationItems : []
  }

  return canAccessPortal(me) ? portalNavigationItems : []
}

const overviewNavigationGroup: LayoutNavEntry = {
  type: 'group',
  titleKey: 'navGroups.overview',
  items: [{ icon: Widget, labelKey: 'nav.dashboard', to: '/admin' }],
}

const operationsNavigationGroup: LayoutNavEntry = {
  type: 'group',
  titleKey: 'navGroups.operations',
  items: [
    { icon: Buildings2, labelKey: 'nav.units', to: '/admin/units' },
    {
      type: 'collapsible',
      icon: UsersGroupRounded,
      labelKey: 'nav.people',
      children: [
        {
          icon: UsersGroupRounded,
          labelKey: 'nav.residents',
          to: '/admin/residents',
        },
        { icon: KeySquare, labelKey: 'nav.visitors', to: '/admin/visitors' },
      ],
    },
    {
      icon: Calendar,
      labelKey: 'nav.reservations',
      to: '/admin/reservations',
    },
  ],
}

const communicationNavigationGroup: LayoutNavEntry = {
  type: 'group',
  titleKey: 'navGroups.communication',
  items: [
    {
      icon: Speaker,
      labelKey: 'nav.announcements',
      to: '/admin/announcements',
    },
    { icon: ClipboardList, labelKey: 'nav.activity', to: '/admin/activity' },
  ],
}

const accountNavigationGroup: LayoutNavEntry = {
  type: 'group',
  titleKey: 'navGroups.account',
  items: [
    { icon: Buildings2, labelKey: 'nav.locations', to: '/admin/locations' },
    { icon: UsersGroupRounded, labelKey: 'nav.staff', to: '/admin/staff' },
  ],
}

const locationManagerNavigationItems: LayoutNavEntry[] = [
  overviewNavigationGroup,
  operationsNavigationGroup,
  communicationNavigationGroup,
]

const accountAdminNavigationItems: LayoutNavEntry[] = [
  overviewNavigationGroup,
  accountNavigationGroup,
  operationsNavigationGroup,
  communicationNavigationGroup,
]

const frontDeskNavigationItems: LayoutNavEntry[] = [
  {
    type: 'group',
    titleKey: 'navGroups.frontDesk',
    items: [
      { icon: UserCheckRounded, labelKey: 'nav.checkIn', to: '/front-desk' },
      {
        icon: KeySquare,
        labelKey: 'nav.todaysVisitors',
        to: '/front-desk/visitors',
      },
      { icon: Magnifier, labelKey: 'nav.unitLookup', to: '/front-desk/units' },
      {
        icon: Calendar,
        labelKey: 'nav.reservations',
        to: '/front-desk/reservations',
      },
    ],
  },
]

const portalNavigationItems: LayoutNavEntry[] = [
  {
    type: 'group',
    titleKey: 'navGroups.portal',
    items: [{ icon: Widget, labelKey: 'nav.home', to: '/portal' }],
  },
]
