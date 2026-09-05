import {
  Box,
  Buildings,
  Calendar,
  ClipboardList,
  House,
  Settings,
  Speaker,
  UserCheckRounded,
  UserPlusRounded,
  UsersGroupRounded,
  Wallet,
  Widget5,
} from '@solar-icons/react'
import type { LayoutNavEntry } from '../../components/layout/shared/types'
import { hasCapability, isAccountAdmin } from '../auth/access'
import type { MeResponse } from '../auth/types'
import { PendingReservationsBadge } from '../reservations/pending-reservations-badge'
import { filterNavigationEntries, type NavEntrySpec, type NavGroupSpec } from './spec'

/**
 * Everything scoped to the currently selected Location. Visible to any staff
 * role that reaches this surface; entries carry the capability they need
 * (ADR 0036) so front desk keeps its subset.
 */
const locationNavigationGroup: NavGroupSpec = {
  type: 'group',
  titleKey: 'navGroups.location',
  items: [
    { icon: Widget5, iconWeight: 'LineDuotone', labelKey: 'nav.dashboard', to: '/admin' },
    { icon: UserCheckRounded, labelKey: 'nav.residents', to: '/admin/registry/residents' },
    // The desk finds people through Residentes; Unidades carries the ledger.
    { icon: House, labelKey: 'nav.units', to: '/admin/registry/units', visibleTo: hasCapability('registry.manage') },
    {
      badge: PendingReservationsBadge,
      icon: Calendar,
      labelKey: 'nav.reservations',
      to: '/admin/reservations',
    },
    {
      icon: Speaker,
      labelKey: 'nav.announcements',
      to: '/admin/announcements',
      visibleTo: hasCapability('announcements.manage'),
    },
    {
      icon: Wallet,
      labelKey: 'nav.finances',
      to: '/admin/finances',
      visibleTo: hasCapability('finances.manage'),
    },
  ],
}

/**
 * The desk's logs: visitors and packages, arrival → resolution. A section of
 * its own (mockups 15–17) so the desk reaches its tools in one click.
 */
const receptionNavigationGroup: NavGroupSpec = {
  type: 'group',
  titleKey: 'navGroups.reception',
  items: [
    { icon: UserPlusRounded, labelKey: 'nav.visitors', to: '/admin/visitors' },
    { icon: Box, labelKey: 'nav.packages', to: '/admin/packages' },
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
    { icon: Buildings, labelKey: 'nav.locations', to: '/admin/locations' },
    { icon: UsersGroupRounded, labelKey: 'nav.staff', to: '/admin/staff' },
    { icon: ClipboardList, labelKey: 'nav.activity', to: '/admin/activity' },
    { icon: Settings, labelKey: 'nav.settings', to: '/admin/settings' },
  ],
}

const adminSurfaceNavigation: NavEntrySpec[] = [
  locationNavigationGroup,
  receptionNavigationGroup,
  administrationNavigationGroup,
]

export function getAdminNavigation(me: MeResponse): LayoutNavEntry[] {
  return filterNavigationEntries(adminSurfaceNavigation, me)
}
