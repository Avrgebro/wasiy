import { describe, expect, it } from 'vitest'
import {
  canAccessFrontDesk,
  canAccessPortal,
  getAvailableNavigationItems,
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

  it('derives admin navigation from account admin context', () => {
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

    expect(JSON.stringify(navItems)).toContain('nav.staff')
    expect(JSON.stringify(navItems)).toContain('nav.locations')
    expect(JSON.stringify(navItems)).toContain('navGroups.registry')
    expect(JSON.stringify(navItems)).toContain('/admin/registry/units')
    expect(JSON.stringify(navItems)).toContain('/admin/registry/residents')
    expect(JSON.stringify(navItems)).toContain('/admin/registry/vehicles')
  })

  it('shows registry navigation to location managers', () => {
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

    expect(JSON.stringify(navItems)).toContain('navGroups.registry')
    expect(JSON.stringify(navItems)).toContain('/admin/registry/vehicles')
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
