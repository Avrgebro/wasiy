import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { LocationSummary } from './api'

const navigateSpy = vi.fn()
let currentSearch: Record<string, unknown> = {}

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({
      useNavigate: () => navigateSpy,
      useSearch: () => currentSearch,
    }),
  }
})

// Imported after the mock so the page picks up the stubbed route api.
const { LocationsPage } = await import('./locations-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(
  config: AxiosResponse['config'],
  data: unknown,
  status = 200,
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  }
}

function meResponse() {
  return {
    user: {
      id: 'usr_1',
      first_name: 'Alejandra',
      last_name: 'Admin',
      name: 'Alejandra Admin',
      email: 'admin@wasiy.test',
    },
    accounts: [{ id: 'acc_1', name: 'Administradora Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Administradora Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central' },
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function locationSummary(overrides: Partial<LocationSummary> = {}): LocationSummary {
  return {
    id: 'loc_1',
    account_id: 'acc_1',
    name: 'Edificio Central',
    slug: 'edificio-central',
    type: 'multifamily_building',
    timezone: 'America/Lima',
    address_line1: 'Av. Javier Prado Este 123',
    address_line2: null,
    district: 'San Isidro',
    city: 'Lima',
    state: null,
    postal_code: null,
    country: 'PE',
    formatted_address: 'Av. Javier Prado Este 123, San Isidro, Lima',
    phone: null,
    contact_email: null,
    access_notes: null,
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

function listResponse(locations: LocationSummary[]) {
  return {
    data: locations,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: locations.length,
    },
  }
}

function installAdapter(locations: LocationSummary[]) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    if (config.url === '/api/me') {
      return Promise.resolve(axiosResponse(config, meResponse()))
    }

    if (config.url?.startsWith('/api/accounts/acc_1/locations')) {
      return Promise.resolve(axiosResponse(config, listResponse(locations)))
    }

    return Promise.reject(new Error(`Unexpected request: ${config.url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <LocationsPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('LocationsPage', () => {
  beforeEach(() => {
    currentSearch = {}
    navigateSpy.mockReset()
  })

  afterEach(() => {
    cleanup()
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('renders location tiles with counts, badges, and the no-photo placeholder', async () => {
    installAdapter([
      locationSummary(),
      locationSummary({
        id: 'loc_2',
        name: 'Condominio Vista Verde',
        status: 'deactivated',
        cover_photo_url: null,
      }),
    ])

    renderPage()

    expect(await screen.findByText('Edificio Central')).toBeInTheDocument()
    expect(screen.getByText('Condominio Vista Verde')).toBeInTheDocument()
    // The active location marker follows /me, the status badges the data.
    expect(screen.getByText('Ubicación activa')).toBeInTheDocument()
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
    expect(screen.getAllByText('86').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin fotos aún').length).toBeGreaterThan(0)
    expect(
      screen.getByText('2 propiedades en la cuenta Administradora Horizonte.'),
    ).toBeInTheDocument()
  })

  it('changing a filter navigates with the new search and resets the page', async () => {
    installAdapter([locationSummary()])
    renderPage()
    await screen.findByText('Edificio Central')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Filtros' }))
    await user.click(await screen.findByPlaceholderText('Todos los estados'))
    await user.click(await screen.findByRole('option', { name: 'Activa' }))

    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.any(Function) }),
    )
    const searchReducer = navigateSpy.mock.calls.at(-1)?.[0].search
    expect(searchReducer({ page: 3 })).toEqual({ page: 1, status: 'active' })
  })

  it('distinguishes the empty account from empty filter results', async () => {
    installAdapter([])
    currentSearch = {}
    const first = renderPage()
    expect(await screen.findByText('Aún no hay ubicaciones')).toBeInTheDocument()
    first.unmount()

    currentSearch = { search: 'vista' }
    renderPage()
    expect(await screen.findByText('Ningún resultado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument()
  })

  it('the deactivate modal names the affected counts before confirming', async () => {
    installAdapter([locationSummary({ id: 'loc_9', name: 'Torre Norte' })])
    renderPage()
    await screen.findByText('Torre Norte')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Acciones para Torre Norte' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Desactivar' }))

    expect(await screen.findByText('¿Desactivar Torre Norte?')).toBeInTheDocument()
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Unidades afectadas')).toBeInTheDocument()
    expect(within(modal).getByText('Residentes con acceso')).toBeInTheDocument()
    expect(within(modal).getByText('Personal asignado')).toBeInTheDocument()
    expect(within(modal).getByText('214')).toBeInTheDocument()
  })

  it('creating a location posts the payload and closes the drawer', async () => {
    const created = locationSummary({ id: 'loc_new', name: 'Torre Mirador' })
    let posted: unknown = null
    apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
      if (config.url === '/api/me') {
        return Promise.resolve(axiosResponse(config, meResponse()))
      }
      if (config.url === '/api/accounts/acc_1/locations' && config.method === 'post') {
        posted = JSON.parse(String(config.data))
        return Promise.resolve(axiosResponse(config, { data: created }, 201))
      }
      if (config.url?.startsWith('/api/accounts/acc_1/locations')) {
        return Promise.resolve(
          axiosResponse(config, listResponse(posted ? [locationSummary(), created] : [locationSummary()])),
        )
      }
      return Promise.reject(new Error(`Unexpected request: ${config.url}`))
    })

    renderPage()
    await screen.findByText('Edificio Central')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Nueva ubicación' }))
    await user.type(await screen.findByLabelText('Nombre de la ubicación'), 'Torre Mirador')
    await user.type(screen.getByLabelText('Dirección línea 1'), 'Malecón de la Reserva 610')
    await user.type(screen.getByLabelText('Ciudad'), 'Lima')
    await user.click(screen.getByRole('button', { name: 'Crear ubicación' }))

    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted).toMatchObject({
      name: 'Torre Mirador',
      type: 'multifamily_building',
      address_line1: 'Malecón de la Reserva 610',
      city: 'Lima',
      country: 'PE',
    })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Crear ubicación' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('Torre Mirador')).toBeInTheDocument()
  })
})
