import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { ADMIN_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { UnitSummary } from './api'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1, search: '', sort: '', type: '', status: '' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useNavigate: () => navigateSpy, useSearch: () => currentSearch }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

const { UnitsPage } = await import('./units-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse() {
  return {
    user: { id: 'usr_1', first_name: 'Alejandra', last_name: 'Admin', name: 'Alejandra Admin', email: 'admin@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', capabilities: ADMIN_CAPABILITIES },
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function unit(overrides: Partial<UnitSummary> = {}): UnitSummary {
  return {
    id: 'un_402',
    account_id: 'acc_1',
    location_id: 'loc_1',
    unit_number: '402',
    type: 'apartment',
    building_id: 'bd_a',
    building_code: 'TA',
    building_name: 'Torre A',
    floor: '4',
    area_m2: 118,
    participation_share: 1.18,
    maintenance_fee: 420,
    parking_spots: ['E-23'],
    storage_rooms: [],
    status: 'active',
    notes: null,
    resident_count: 3,
    vehicle_count: 1,
    occupancy: 'occupied',
    portal_state: 'active',
    primary_contact: { name: 'Carlos Mendoza', phone: null, email: null, resident_id: 'rs_1', unit_membership_id: 'um_1' },
    ...overrides,
  }
}

function installAdapter(rows: UnitSummary[]) {
  const requests: string[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    requests.push(url)
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse()))
    if (url === '/api/locations/loc_1/buildings') return Promise.resolve(axiosResponse(config, { data: [{ id: 'bd_a', location_id: 'loc_1', name: 'Torre A', code: 'TA', sort_order: 1, units_count: 3 }, { id: 'bd_b', location_id: 'loc_1', name: 'Torre B', code: null, sort_order: 2, units_count: 0 }] }))
    if (url.includes('/units')) {
      return Promise.resolve(axiosResponse(config, { data: rows, meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length } }))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  return requests
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <UnitsPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  for (const key of Object.keys(currentSearch)) delete currentSearch[key]
  Object.assign(currentSearch, { page: 1, search: '', sort: '', type: '', status: '' })
})

describe('UnitsPage', () => {
  it('renders units grouped by building with derived states, and opens the detail on row click', async () => {
    const requests = installAdapter([
      unit(),
      unit({ id: 'un_305', unit_number: '305', building_name: 'Torre B', floor: '3', area_m2: 88, maintenance_fee: null, parking_spots: ['E-07'], resident_count: 1, occupancy: 'attention', portal_state: 'not_invited', primary_contact: null, vehicle_count: 0 }),
      unit({ id: 'un_609', unit_number: '609', building_name: 'Torre B', floor: '6', resident_count: 0, occupancy: 'vacant', portal_state: null, primary_contact: null, vehicle_count: 0, parking_spots: [] }),
    ])

    renderPage()

    expect(await screen.findByText('402')).toBeInTheDocument()
    expect(screen.getByText('3 unidades · Edificio Central')).toBeInTheDocument()
    // Building bands.
    expect(screen.getByText('Torre A')).toBeInTheDocument()
    expect(screen.getAllByText('Torre B')).toHaveLength(1)
    // Identity lines and derived states.
    expect(screen.getByText('E-23')).toBeInTheDocument()
    expect(screen.getByText('Piso 4 · Depto. · 118 m²')).toBeInTheDocument()
    expect(screen.getByText(/Carlos Mendoza/)).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.getByText('— Sin contacto principal')).toBeInTheDocument()
    expect(screen.getByText('— Sin residentes')).toBeInTheDocument()
    expect(screen.getByText('Ocupada')).toBeInTheDocument()
    expect(screen.getByText('Atención')).toBeInTheDocument()
    expect(screen.getByText('Vacía')).toBeInTheDocument()
    expect(screen.getByText('En el portal')).toBeInTheDocument()
    expect(screen.getByText('Sin invitar')).toBeInTheDocument()
    expect(requests.some((url) => url.includes('/api/locations/loc_1/units?page=1'))).toBe(true)

    await userEvent.click(screen.getByText('305'))
    expect(navigateSpy).toHaveBeenLastCalledWith({ to: '/admin/registry/units/$unitId', params: { unitId: 'un_305' } })
  })

  it('chips and search land on the URL and the request', async () => {
    currentSearch.chip = 'no_fee'
    currentSearch.search = 'axb'
    const requests = installAdapter([unit()])

    renderPage()
    await screen.findByText('402')

    expect(requests.some((url) => url.includes('fee=missing') && url.includes('search=axb'))).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Vacías' }))
    expect(navigateSpy.mock.calls.at(-1)![0].search({ page: 4 })).toEqual({ chip: 'vacant', page: 1 })
  })
})
