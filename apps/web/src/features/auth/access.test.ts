import { describe, expect, it } from 'vitest'
import { WidgetIcon } from '@solar-icons/react/dynamic'
import {
  ADMIN_CAPABILITIES,
  can,
  canAccessPortal,
  FRONT_DESK_CAPABILITIES,
  MANAGER_CAPABILITIES,
  getDefaultAuthenticatedRoute,
  getDefaultLocation,
  isAccountAdmin,
  requiresAccountSelection,
  surfaceAccess,
} from './access'
import { getAdminNavigation } from '../navigation/admin-navigation'
import { filterNavigationEntries } from '../navigation/spec'
import type { MeResponse } from './types'

function makeMe(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: {
      id: 'usr_1',
      first_name: 'Ana',
      last_name: 'Salas',
      name: 'Ana Salas',
      email: 'ana@wasiy.test',
    },
    accounts: [
      {
        id: 'acc_1',
        name: 'Cuenta 1',
        slug: 'cuenta-1',
        locations_count: 1,
        subscription: null,
        timezone: 'America/Lima',
      },
    ],
    active_account: {
      id: 'acc_1',
      name: 'Cuenta 1',
      slug: 'cuenta-1',
      locations_count: 1,
      subscription: null,
      timezone: 'America/Lima',
    },
    active_location: null,
    roles: {
      account: [],
      location: [],
    },
    accessible_locations: [],
    resident_memberships: [],
    ...overrides,
  }
}

describe('access helpers', () => {
  it('requires account selection for multi-account users without an active account', () => {
    const me = makeMe({
      accounts: [
        {
          id: 'acc_1',
          name: 'Cuenta 1',
          slug: 'cuenta-1',
          locations_count: 1,
          subscription: null,
          timezone: 'America/Lima',
        },
        {
          id: 'acc_2',
          name: 'Cuenta 2',
          slug: 'cuenta-2',
          locations_count: 1,
          subscription: null,
          timezone: 'America/Lima',
        },
      ],
      active_account: null,
    })

    expect(requiresAccountSelection(me)).toBe(true)
    expect(getDefaultAuthenticatedRoute(me)).toBe('/select-account')
  })

  it('does not treat the first accessible location as selected', () => {
    const me = makeMe({
      accessible_locations: [
        {
          id: 'loc_1',
          account_id: 'acc_1',
          name: 'Torre Norte',
          slug: 'torre-norte',
          timezone: 'America/Lima',
          address: null,
          roles: ['location_manager'],
          capabilities: MANAGER_CAPABILITIES,
          country: 'PE', access_source: 'location_role',
        },
      ],
    })

    expect(getDefaultLocation(me)).toBeNull()
  })

  it('routes front desk-only users to the front desk surface', () => {
    const me = makeMe({
      active_location: {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        address: null,
        roles: [],
        capabilities: FRONT_DESK_CAPABILITIES,
        country: 'PE', access_source: 'location_role',
      },
      roles: {
        account: [],
        location: [
          {
            account_id: 'acc_1',
            location_id: 'loc_1',
            role: 'front_desk',
          },
        ],
      },
    })

    expect(can(me, 'reception.manage')).toBe(true)
    // Front desk shares the admin surface (read-only subset).
    expect(getDefaultAuthenticatedRoute(me)).toBe('/admin')
  })

  it('keeps portal guarded until resident memberships exist', () => {
    const me = makeMe()

    expect(canAccessPortal(me)).toBe(false)
    expect(getDefaultAuthenticatedRoute(me)).toBe('/no-access')

    const residentMe = makeMe({
      resident_memberships: [
        {
          account_id: 'acc_1',
          country: 'PE',
          is_primary_contact: true,
          location_id: 'loc_1',
          resident_id: 'res_1',
          unit_id: 'unit_1',
          unit_label: 'Torre A / 301',
          unit_membership_id: 'membership_1',
        },
      ],
    })

    expect(canAccessPortal(residentMe)).toBe(true)
    // Each build lands on its own surface; the other host sends them to /no-access.
    expect(getDefaultAuthenticatedRoute(residentMe, 'portal')).toBe('/portal')
    expect(getDefaultAuthenticatedRoute(residentMe, 'admin')).toBe('/no-access')
  })

  it('gives account admins the location section', () => {
    const me = makeMe({
      active_location: {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        address: null,
        roles: [],
        capabilities: ADMIN_CAPABILITIES,
        country: 'PE', access_source: 'location_role',
      },
      roles: {
        account: [
          {
            account_id: 'acc_1',
            role: 'account_admin',
          },
        ],
        location: [],
      },
    })

    const navItems = getAdminNavigation(me)
    const serialized = JSON.stringify(navItems)

    expect(serialized).toContain('navGroups.location')
    expect(serialized).toContain('/admin')
    expect(serialized).toContain('/admin/units')
    // Vehicles live inside units since M9; no standalone entry.
    expect(serialized).not.toContain('/admin/registry/vehicles')

    // Recepción is its own section, not a collapsible inside Ubicación.
    expect(serialized).toContain('navGroups.reception')
    expect(serialized).not.toContain('nav.reception')
    expect(serialized).toContain('/admin/residents')

    // Manage-only entries and the whole administration section.
    expect(serialized).toContain('/admin/announcements')
    expect(serialized).toContain('/admin/finances')
    expect(serialized).toContain('navGroups.administration')
    expect(serialized).toContain('/admin/staff')
    expect(serialized).toContain('/admin/locations')
  })

  it('shows location managers the same location section', () => {
    const me = makeMe({
      active_location: {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        address: null,
        roles: [],
        capabilities: MANAGER_CAPABILITIES,
        country: 'PE', access_source: 'location_role',
      },
      roles: {
        account: [],
        location: [
          {
            account_id: 'acc_1',
            location_id: 'loc_1',
            role: 'location_manager',
          },
        ],
      },
    })

    const navItems = getAdminNavigation(me)
    const serialized = JSON.stringify(navItems)

    expect(serialized).toContain('navGroups.location')
    // Vehicles live inside units since M9; no standalone entry.
    expect(serialized).not.toContain('/admin/registry/vehicles')

    // A manager manages the registry, so the manage-only entries stay.
    expect(can(me, 'registry.manage')).toBe(true)
    expect(serialized).toContain('/admin/units')
    expect(serialized).toContain('/admin/announcements')
    expect(serialized).toContain('/admin/finances')

    // Account-wide administration is not theirs.
    expect(isAccountAdmin(me)).toBe(false)
    expect(serialized).not.toContain('navGroups.administration')
    expect(serialized).not.toContain('/admin/staff')
    expect(serialized).not.toContain('/admin/locations')
    expect(serialized).not.toContain('/admin/settings')
  })

  it('gives front desk the desk subset: no units, finances or announcements', () => {
    const frontDeskMe = makeMe({
      active_location: {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        address: null,
        roles: [],
        capabilities: FRONT_DESK_CAPABILITIES,
        country: 'PE', access_source: 'location_role',
      },
      roles: {
        account: [],
        location: [
          { account_id: 'acc_1', location_id: 'loc_1', role: 'front_desk' },
        ],
      },
    })

    expect(can(frontDeskMe, 'registry.manage')).toBe(false)
    expect(can(frontDeskMe, 'registry.view')).toBe(true)

    const serialized = JSON.stringify(getAdminNavigation(frontDeskMe))
    expect(serialized).toContain('/admin/visitors')
    expect(serialized).toContain('/admin/residents')
    expect(serialized).toContain('/admin/reservations')
    expect(serialized).not.toContain('/admin/units')
    expect(serialized).not.toContain('/admin/finances')
    expect(serialized).not.toContain('/admin/announcements')
  })

  it('reads capabilities from the active location, not from every role held', () => {
    // Manager elsewhere, front desk here: the UI follows the location being viewed.
    const me = makeMe({
      active_location: {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        address: null,
        roles: [],
        capabilities: FRONT_DESK_CAPABILITIES,
        country: 'PE', access_source: 'location_role',
      },
      roles: {
        account: [],
        location: [
          { account_id: 'acc_1', location_id: 'loc_2', role: 'location_manager' },
          { account_id: 'acc_1', location_id: 'loc_1', role: 'front_desk' },
        ],
      },
    })

    expect(can(me, 'finances.manage')).toBe(false)
    expect(can(makeMe(), 'registry.view')).toBe(false)
  })
})

describe('navigation filtering', () => {
  const me = makeMe()
  const leaf = (labelKey: string, visibleTo?: (me: MeResponse) => boolean) => ({
    icon: WidgetIcon,
    labelKey,
    to: '/admin' as const,
    ...(visibleTo ? { visibleTo } : {}),
  })

  it('drops entries whose predicate fails and keeps unguarded ones', () => {
    const entries = filterNavigationEntries(
      [leaf('nav.open'), leaf('nav.hidden', () => false)],
      me,
    )

    expect(entries).toHaveLength(1)
    expect(JSON.stringify(entries)).toContain('nav.open')
  })

  it('drops a group whose own predicate fails', () => {
    const entries = filterNavigationEntries(
      [
        {
          type: 'group',
          titleKey: 'navGroups.secret',
          visibleTo: () => false,
          items: [leaf('nav.inside')],
        },
      ],
      me,
    )

    expect(entries).toEqual([])
  })

  it('drops a visible group once every item inside it is filtered out', () => {
    const entries = filterNavigationEntries(
      [
        {
          type: 'group',
          titleKey: 'navGroups.empty',
          items: [leaf('nav.hidden', () => false)],
        },
      ],
      me,
    )

    // An orphan heading with nothing under it is worse than no section.
    expect(entries).toEqual([])
  })

  it('drops a collapsible whose children are all filtered out', () => {
    const entries = filterNavigationEntries(
      [
        {
          type: 'collapsible',
          icon: WidgetIcon,
          labelKey: 'nav.people',
          children: [leaf('nav.hidden', () => false)],
        },
      ],
      me,
    )

    expect(entries).toEqual([])
  })

  it('keeps a collapsible with at least one visible child', () => {
    const entries = filterNavigationEntries(
      [
        {
          type: 'collapsible',
          icon: WidgetIcon,
          labelKey: 'nav.people',
          children: [leaf('nav.hidden', () => false), leaf('nav.shown')],
        },
      ],
      me,
    )

    expect(entries).toHaveLength(1)
    const serialized = JSON.stringify(entries)
    expect(serialized).toContain('nav.shown')
    expect(serialized).not.toContain('nav.hidden')
  })

  it('gives front desk the read-only subset of the admin navigation', () => {
    const me = makeMe({
      roles: {
        account: [],
        location: [
          {
            account_id: 'acc_1',
            location_id: 'loc_1',
            role: 'front_desk',
          },
        ],
      },
    })

    expect(surfaceAccess.admin(me)).toBe(true)
    const serialized = JSON.stringify(getAdminNavigation(me))
    expect(serialized).toContain('/admin/reservations')
    // Unidades carries the ledger; the desk finds people through Residentes.
    expect(serialized).not.toContain('/admin/units')
    expect(serialized).not.toContain('/admin/finances')
    expect(serialized).not.toContain('/admin/announcements')
    expect(serialized).not.toContain('/admin/staff')
  })
})
