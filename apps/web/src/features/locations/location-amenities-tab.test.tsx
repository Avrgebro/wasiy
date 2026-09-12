import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { AmenitySummary } from './amenities-api'
import { LocationAmenitiesTab } from './location-amenities-tab'

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function amenity(overrides: Partial<AmenitySummary> = {}): AmenitySummary {
  return {
    id: 'amn_1',
    account_id: 'acc_1',
    location_id: 'loc_1',
    name: 'Salón de eventos',
    slug: 'salon-de-eventos',
    description: null,
    is_reservable: true,
    booking_mode: 'approval',
    open_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    daily_capacity: null,
    fee_amount_minor: 15000,
    deposit_amount_minor: 30000,
    status: 'active',
    deactivated_at: null,
    photos: [],
    cover_photo_url: null,
    ...overrides,
  }
}

function settingsResponse() {
  return {
    data: {
      values: {
        visitor_preregistration_enabled: true,
        visitor_auto_checkout_hours: 0,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        announcements_location_manager_can_post: true,
        announcements_email_residents: false,
      },
      explanation: {},
    },
  }
}

function installAdapter(amenities: AmenitySummary[], onCreate?: (payload: unknown) => void) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const base = '/api/accounts/acc_1/locations/loc_1'

    if (config.url === `${base}/amenities` && config.method === 'get') {
      return Promise.resolve(axiosResponse(config, { data: amenities }))
    }
    if (config.url === `${base}/amenities` && config.method === 'post') {
      const payload = JSON.parse(String(config.data))
      onCreate?.(payload)
      return Promise.resolve(axiosResponse(config, { data: amenity({ id: 'amn_new', ...payload }) }, 201))
    }
    if (config.url === `${base}/settings`) {
      return Promise.resolve(axiosResponse(config, settingsResponse()))
    }
    return Promise.reject(new Error(`Unexpected request: ${config.method} ${config.url}`))
  })
}

function renderTab(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <MantineProvider env="test">
      <Notifications autoClose={false} />
      <QueryClientProvider client={queryClient}>
        <LocationAmenitiesTab
          accountId="acc_1"
          locationId="loc_1"
          readOnly={readOnly}
        />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('LocationAmenitiesTab', () => {
  afterEach(() => {
    cleanup()
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('renders the table with open days, capacity, fees, and dashes for a common space', async () => {
    installAdapter([
      amenity(),
      amenity({
        id: 'amn_2',
        name: 'Lobby / recepción',
        is_reservable: false,
        fee_amount_minor: null,
        deposit_amount_minor: null,
        open_days: [],
      }),
      amenity({ id: 'amn_3', name: 'Cancha de squash', status: 'deactivated', fee_amount_minor: null, deposit_amount_minor: null, open_days: ['monday', 'wednesday', 'friday'], daily_capacity: 2 }),
    ])
    renderTab()

    expect(await screen.findByText('Salón de eventos')).toBeInTheDocument()
    expect(screen.getByText('Todos')).toBeInTheDocument()
    expect(screen.getByText('L, Mi, V')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('S/ 150 + depósito S/ 300')).toBeInTheDocument()
    expect(screen.getAllByText('Requiere aprobación').length).toBeGreaterThan(0)
    expect(screen.getByText('Común')).toBeInTheDocument()
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
    expect(screen.getByText('3 amenidades · 1 reservables')).toBeInTheDocument()

    const commonRow = screen.getByText('Lobby / recepción').closest('tr')!
    expect(within(commonRow).getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('renders the empty state with the add action', async () => {
    installAdapter([])
    renderTab()

    expect(await screen.findByText('No hay resultados')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Agregar amenidad' }).length).toBeGreaterThan(0)
  })

  it('read-only mode hides every mutation affordance', async () => {
    installAdapter([amenity()])
    renderTab(true)

    await screen.findByText('Salón de eventos')
    expect(screen.queryByRole('button', { name: 'Agregar amenidad' })).not.toBeInTheDocument()
    expect(screen.queryByText('Desactivar')).not.toBeInTheDocument()
    expect(screen.getByText('Salón de eventos').closest('tr')).not.toHaveClass('cursor-pointer')
    expect(screen.queryByText('›')).not.toBeInTheDocument()
  })

  it('a reservable amenity needs at least one open day', async () => {
    installAdapter([])
    renderTab()
    await screen.findByText('No hay resultados')

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Agregar amenidad' })[0])
    await user.type(await screen.findByLabelText(/Nombre/), 'Piscina')

    // Every day starts checked; clearing them all blocks saving.
    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      await user.click(screen.getByRole('checkbox', { name: day }))
    }
    expect(await screen.findByText('Elige al menos un día.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear amenidad' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Lunes' }))
    expect(screen.getByRole('button', { name: 'Crear amenidad' })).toBeEnabled()
  })

  it('creating posts the open days, the daily capacity and fees in cents', async () => {
    let posted: Record<string, unknown> | null = null
    installAdapter([], (payload) => {
      posted = payload as Record<string, unknown>
    })
    renderTab()
    await screen.findByText('No hay resultados')

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Agregar amenidad' })[0])
    await user.type(await screen.findByLabelText(/Nombre/), 'Piscina')
    await user.click(screen.getByRole('checkbox', { name: 'Sábado' }))
    await user.click(screen.getByRole('checkbox', { name: 'Domingo' }))
    await user.type(screen.getByLabelText('Cupo por día'), '3')
    await user.type(screen.getByLabelText('Cuota de uso'), '50')
    await user.click(screen.getByRole('button', { name: 'Crear amenidad' }))

    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted).toEqual({
      name: 'Piscina',
      description: null,
      is_reservable: true,
      booking_mode: 'instant',
      open_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      daily_capacity: 3,
      fee_amount_minor: 5000,
      deposit_amount_minor: null,
    })
  })

  it('an empty capacity posts null', async () => {
    let posted: Record<string, unknown> | null = null
    installAdapter([], (payload) => {
      posted = payload as Record<string, unknown>
    })
    renderTab()
    await screen.findByText('No hay resultados')

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Agregar amenidad' })[0])
    await user.type(await screen.findByLabelText(/Nombre/), 'Gimnasio')
    await user.click(screen.getByRole('button', { name: 'Crear amenidad' }))

    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted).toMatchObject({ name: 'Gimnasio', daily_capacity: null, open_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] })
  })
})
