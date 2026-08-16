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
import { canManageRegistry, isAccountAdmin, type Surface } from '../auth/access'
import type { MeResponse } from '../auth/types'

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

const surfaceNavigation: Record<Surface, NavEntrySpec[]> = {
  admin: adminSurfaceNavigation,
  'front-desk': frontDeskNavigation,
  portal: portalNavigation,
}

export function getSurfaceNavigation(me: MeResponse, surface: Surface): LayoutNavEntry[] {
  return filterNavigationEntries(surfaceNavigation[surface], me)
}
