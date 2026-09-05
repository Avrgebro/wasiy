import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { LocationSummary } from './api'

const navigateSpy = vi.fn()
let currentSearch: Record<string, unknown> = { tab: 'info' }
let currentParams: Record<string, string> = { locationId: 'loc_1' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({
      useNavigate: () => navigateSpy,
      useParams: () => currentParams,
      useSearch: () => currentSearch,
    }),
    Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  }
})

const { LocationDetailPage } = await import('./location-detail-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse() {
  return {
    user: { id: 'usr_1', first_name: 'Alejandra', last_name: 'Admin', name: 'Alejandra Admin', email: 'admin@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Administradora Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Administradora Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: null,
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function locationDetail(overrides: Partial<LocationSummary> = {}): LocationSummary {
  return {
    id: 'loc_1',
    account_id: 'acc_1',
    name: 'Edificio Central',
    slug: 'edificio-central',
    type: 'multifamily_building',
    timezone: 'America/Lima',
    address_line1: 'Av. Javier Prado Este 123',
    address_line2: 'Torre A, oficina de administración',
    district: 'San Isidro',
    city: 'Lima',
    state: 'Lima Metropolitana',
    postal_code: '15046',
    country: 'PE',
    formatted_address: 'Av. Javier Prado Este 123, San Isidro, Lima',
    phone: '+51 1 440 2210',
    contact_email: 'central@horizonte.pe',
    access_notes: 'Ingreso vehicular por Calle Las Camelias.',
    status: 'active',
    deactivated_at: null,
    deactivated_by: null,
    photos: [],
    cover_photo_url: null,
    units_count: 86,
    residents_count: 214,
    vehicles_count: 61,
    staff_count: 5,
    unclaimed_invitations_count: 27,
    active_amenities_count: 0,
    ...overrides,
  }
}

function installAdapter(location: LocationSummary | null, staff: unknown[] = []) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    if (config.url === '/api/me') {
      return Promise.resolve(axiosResponse(config, meResponse()))
    }
    if (config.url === `/api/accounts/acc_1/locations/${currentParams.locationId}`) {
      if (!location) {
        const error = Object.assign(new Error('Not found'), {
          isAxiosError: true,
          response: axiosResponse(config, { message: 'Not found' }, 404),
          config,
        })
        return Promise.reject(error)
      }
      return Promise.resolve(axiosResponse(config, { data: location }))
    }
    if (config.url?.startsWith('/api/accounts/acc_1/staff')) {
      return Promise.resolve(
        axiosResponse(config, {
          data: staff,
          meta: { current_page: 1, last_page: 1, per_page: 100, total: staff.length },
        }),
      )
    }
    return Promise.reject(new Error(`Unexpected request: ${config.url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <LocationDetailPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('LocationDetailPage', () => {
  beforeEach(() => {
    currentSearch = { tab: 'info' }
    currentParams = { locationId: 'loc_1' }
    navigateSpy.mockReset()
  })

  afterEach(() => {
    cleanup()
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('renders the header, tabs, stats, and the info read view', async () => {
    installAdapter(locationDetail())
    renderPage()

    expect((await screen.findAllByText('Edificio Central')).length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Información' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Amenidades' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Personal' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByText('Información general')).toBeInTheDocument()
    expect(screen.getByText('86')).toBeInTheDocument()
    expect(screen.getByText('Torre A, oficina de administración')).toBeInTheDocument()
    expect(screen.getByText('Ingreso vehicular por Calle Las Camelias.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar ubicación' })).toBeInTheDocument()
  })

  it('switching tabs writes the tab into the URL', async () => {
    installAdapter(locationDetail())
    renderPage()
    await screen.findAllByText('Edificio Central')

    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'Personal' }))

    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ search: { tab: 'staff' } }),
    )
  })

  it('renders the read-only staff tab from the staff endpoint', async () => {
    currentSearch = { tab: 'staff' }
    installAdapter(locationDetail(), [
      {
        id: 'usr_2',
        first_name: 'María',
        last_name: 'Torres',
        name: 'María Torres',
        email: 'maria@wasiy.test',
        deactivated_at: null,
        account_role: null,
        location_assignments: [
          { location_id: 'loc_1', location_name: 'Edificio Central', role: 'location_manager' },
        ],
      },
    ])
    renderPage()

    expect(await screen.findByText('María Torres')).toBeInTheDocument()
    expect(screen.getByText('Vista de solo lectura.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Invitar/ })).not.toBeInTheDocument()
  })

  it('a deactivated location shows the banner and blocks editing', async () => {
    installAdapter(
      locationDetail({
        status: 'deactivated',
        deactivated_at: '2026-08-03T12:00:00Z',
        deactivated_by: { id: 'usr_1', name: 'Admin. Horizonte' },
      }),
    )
    renderPage()

    expect(await screen.findByText('Esta ubicación está desactivada')).toBeInTheDocument()
    expect(screen.getByText('Edición bloqueada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar ubicación' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivar ubicación' })).toBeInTheDocument()
  })

  it('the edit drawer exposes the sensitive zone leading to the counts modal', async () => {
    installAdapter(locationDetail())
    renderPage()
    await screen.findAllByText('Edificio Central')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Editar ubicación' }))
    expect(await screen.findByText('Zona sensible')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Desactivar' }))

    expect(await screen.findByText('¿Desactivar Edificio Central?')).toBeInTheDocument()
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Unidades afectadas')).toBeInTheDocument()
    expect(within(modal).getByText('214')).toBeInTheDocument()
  })

  it('an unknown location renders the not-found state', async () => {
    installAdapter(null)
    renderPage()

    expect(await screen.findByText('Ubicación no encontrada')).toBeInTheDocument()
    expect(screen.getByText('Volver a Ubicaciones')).toBeInTheDocument()
  })
})
