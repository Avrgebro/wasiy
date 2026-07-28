import { Widget } from '@solar-icons/react'
import { describe, expect, it } from 'vitest'
import {
  canAccessFrontDesk,
  canAccessPortal,
  canManageRegistry,
  filterNavigationEntries,
  getAvailableNavigationItems,
  isAccountAdmin,
  getDefaultAuthenticatedRoute,
  getDefaultLocation,
  requiresAccountSelection,
} from './access'
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
        timezone: 'America/Lima',
      },
    ],
    active_account: {
      id: 'acc_1',
      name: 'Cuenta 1',
      slug: 'cuenta-1',
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
          timezone: 'America/Lima',
        },
        {
          id: 'acc_2',
          name: 'Cuenta 2',
          slug: 'cuenta-2',
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
          access_source: 'location_role',
        },
      ],
    })

    expect(getDefaultLocation(me)).toBeNull()
  })

  it('routes front desk-only users to the front desk surface', () => {
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

    expect(canAccessFrontDesk(me)).toBe(true)
    expect(getDefaultAuthenticatedRoute(me)).toBe('/front-desk')
  })

  it('keeps portal guarded until resident memberships exist', () => {
    const me = makeMe()

    expect(canAccessPortal(me)).toBe(false)
    expect(getDefaultAuthenticatedRoute(me)).toBe('/no-access')

    const residentMe = makeMe({
      resident_memberships: [
        {
          account_id: 'acc_1',
          is_primary_contact: true,
          location_id: 'loc_1',
          resident_id: 'res_1',
          resident_type: 'owner',
          unit_id: 'unit_1',
          unit_label: 'Torre A / 301',
          unit_membership_id: 'membership_1',
        },
      ],
    })

    expect(canAccessPortal(residentMe)).toBe(true)
    expect(getDefaultAuthenticatedRoute(residentMe)).toBe('/portal')
  })

  it('gives account admins the location section', () => {
    const me = makeMe({
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

    const navItems = getAvailableNavigationItems(me, 'admin')
    const serialized = JSON.stringify(navItems)

    expect(serialized).toContain('navGroups.location')
    expect(serialized).toContain('/admin')
    expect(serialized).toContain('/admin/registry/units')
    expect(serialized).toContain('/admin/registry/vehicles')

    // Residents sits inside the People group rather than at the top level.
    expect(serialized).toContain('nav.people')
    expect(serialized).toContain('/admin/registry/residents')

    // Imports is reached from the pages it loads, not from the sidebar.
    expect(serialized).not.toContain('/admin/registry/imports')

    // Manage-only entries and the whole administration section.
    expect(serialized).toContain('/admin/announcements')
    expect(serialized).toContain('/admin/finances')
    expect(serialized).toContain('navGroups.administration')
    expect(serialized).toContain('/admin/staff')
    expect(serialized).toContain('/admin/locations')
  })

  it('shows location managers the same location section', () => {
    const me = makeMe({
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

    const navItems = getAvailableNavigationItems(me, 'admin')
    const serialized = JSON.stringify(navItems)

    expect(serialized).toContain('navGroups.location')
    expect(serialized).toContain('/admin/registry/vehicles')

    // A manager manages the registry, so the manage-only entries stay.
    expect(canManageRegistry(me)).toBe(true)
    expect(serialized).toContain('/admin/announcements')
    expect(serialized).toContain('/admin/finances')

    // Account-wide administration is not theirs.
    expect(isAccountAdmin(me)).toBe(false)
    expect(serialized).not.toContain('navGroups.administration')
    expect(serialized).not.toContain('/admin/staff')
    expect(serialized).not.toContain('/admin/locations')
    expect(serialized).not.toContain('/admin/settings')
  })

  it('separates registry management from surface access for front desk', () => {
    const frontDeskMe = makeMe({
      roles: {
        account: [],
        location: [
          { account_id: 'acc_1', location_id: 'loc_1', role: 'front_desk' },
        ],
      },
    })

    // Front desk reaches no staff surface yet, and must never be treated as
    // able to write to the registry once it does.
    expect(canManageRegistry(frontDeskMe)).toBe(false)
    expect(canAccessFrontDesk(frontDeskMe)).toBe(true)
  })

})

describe('navigation filtering', () => {
  const me = makeMe()
  const leaf = (labelKey: string, visibleTo?: (me: MeResponse) => boolean) => ({
    icon: Widget,
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
          icon: Widget,
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
          icon: Widget,
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

  it('does not expose admin navigation to front desk users', () => {
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

    expect(getAvailableNavigationItems(me, 'admin')).toEqual([])
    expect(JSON.stringify(getAvailableNavigationItems(me, 'front-desk'))).toContain(
      'nav.checkIn',
    )
  })
})
