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
    availability: {
      monday: [{ start: '09:00', end: '22:00' }],
      tuesday: [{ start: '09:00', end: '22:00' }],
      wednesday: [{ start: '09:00', end: '22:00' }],
      thursday: [{ start: '09:00', end: '22:00' }],
      friday: [{ start: '09:00', end: '22:00' }],
      saturday: [{ start: '09:00', end: '22:00' }],
      sunday: [{ start: '09:00', end: '22:00' }],
    },
    slot_minutes: 120,
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
          timezone="America/Lima"
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

  it('renders the table with schedule summary, fees, and dashes for a common space', async () => {
    installAdapter([
      amenity(),
      amenity({
        id: 'amn_2',
        name: 'Lobby / recepción',
        is_reservable: false,
        fee_amount_minor: null,
        deposit_amount_minor: null,
        availability: {},
      }),
      amenity({ id: 'amn_3', name: 'Cancha de squash', status: 'deactivated', fee_amount_minor: null, deposit_amount_minor: null }),
    ])
    renderTab()

    expect(await screen.findByText('Salón de eventos')).toBeInTheDocument()
    expect(screen.getAllByText('L–D · 9:00–22:00').length).toBeGreaterThan(0)
    expect(screen.getByText('S/ 150 + depósito S/ 300')).toBeInTheDocument()
    expect(screen.getAllByText('Requiere aprobación').length).toBeGreaterThan(0)
    expect(screen.getByText('Común')).toBeInTheDocument()
    expect(screen.getByText('Inactiva')).toBeInTheDocument()
    expect(screen.getByText('3 amenidades · 1 reservables')).toBeInTheDocument()

    const commonRow = screen.getByText('Lobby / recepción').closest('tr')!
    expect(within(commonRow).getAllByText('—').length).toBeGreaterThanOrEqual(3)
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

  it('the availability editor blocks an overlapping window and names the range', async () => {
    installAdapter([])
    renderTab()
    await screen.findByText('No hay resultados')

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Agregar amenidad' })[0])
    await user.type(await screen.findByLabelText(/Nombre/), 'Piscina')

    // Open Monday with the default window, add a second overlapping one.
    await user.click(screen.getAllByRole('button', { name: 'Abrir y agregar horario' })[0])
    await user.click(screen.getByRole('button', { name: 'Agregar horario' }))

    const start2 = screen.getByLabelText('Inicio 2 de Lunes')
    const end2 = screen.getByLabelText('Fin 2 de Lunes')
    await user.type(start2, '21:00')
    await user.type(end2, '23:00')

    expect(
      await screen.findByText('Los horarios se superponen entre 21:00 y 22:00. Ajusta uno de los dos para guardar.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear amenidad' })).toBeDisabled()

    // Resolving the overlap re-enables saving.
    await user.clear(start2)
    await user.type(start2, '22:00')
    expect(screen.getByRole('button', { name: 'Crear amenidad' })).toBeEnabled()
  })

  it('copiar a todos los días replicates one day across the week', async () => {
    installAdapter([])
    renderTab()
    await screen.findByText('No hay resultados')

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Agregar amenidad' })[0])
    await screen.findByLabelText(/Nombre/)

    await user.click(screen.getAllByRole('button', { name: 'Abrir y agregar horario' })[0])
    await user.click(screen.getByRole('button', { name: 'Copiar a todos los días' }))

    expect(screen.getByLabelText('Inicio 1 de Domingo')).toHaveValue('09:00')
    expect(screen.queryByRole('button', { name: 'Abrir y agregar horario' })).not.toBeInTheDocument()
  })

  it('creating posts the slot length (default one hour) and fees in cents, no policy fields', async () => {
    let posted: Record<string, unknown> | null = null
    installAdapter([], (payload) => {
      posted = payload as Record<string, unknown>
    })
    renderTab()
    await screen.findByText('No hay resultados')

    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Agregar amenidad' })[0])
    await user.type(await screen.findByLabelText(/Nombre/), 'Piscina')
    await user.click(screen.getAllByRole('button', { name: 'Abrir y agregar horario' })[0])
    expect(screen.getByRole('combobox', { name: 'Duración de cada turno' })).toHaveValue('1 hora')
    await user.click(screen.getByRole('combobox', { name: 'Duración de cada turno' }))
    await user.click(await screen.findByRole('option', { name: '2 horas' }))
    await user.type(screen.getByLabelText('Cuota de uso'), '50')
    await user.click(screen.getByRole('button', { name: 'Crear amenidad' }))

    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted).toMatchObject({
      name: 'Piscina',
      is_reservable: true,
      booking_mode: 'instant',
      slot_minutes: 120,
      fee_amount_minor: 5000,
      deposit_amount_minor: null,
      availability: { monday: [{ start: '09:00', end: '22:00' }] },
    })
    for (const gone of ['capacity', 'max_advance_days', 'max_concurrent_per_unit', 'cancellation_window_hours', 'max_duration_minutes']) {
      expect(posted).not.toHaveProperty(gone)
    }
    expect(Object.keys((posted as unknown as Record<string, unknown>).availability as object)).toEqual(['monday'])
  })
})
