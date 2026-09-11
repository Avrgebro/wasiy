import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { pickDate } from '../../lib/test-dates'
import { ADMIN_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { ReservationSummary } from './api'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = {}

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({
      useNavigate: () => navigateSpy,
      useSearch: () => currentSearch,
    }),
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: Record<string, unknown> }) => (
      <a href={`${to}?${new URLSearchParams(Object.entries(search ?? {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()}`}>
        {children}
      </a>
    ),
  }
})

// Imported after the mock so the page picks up the stubbed route api.
const { ReservationsPage } = await import('./reservations-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: status === 200 ? 'OK' : 'Error' }
}

function meResponse() {
  return {
    user: { id: 'usr_1', first_name: 'Alejandra', last_name: 'Admin', name: 'Alejandra Admin', email: 'admin@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: {
      id: 'loc_1',
      account_id: 'acc_1',
      name: 'Edificio Central',
      slug: 'edificio-central',
      timezone: 'America/Lima',
    capabilities: ADMIN_CAPABILITIES,
    },
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

/** Tomorrow at the given Lima wall-clock hour, as a UTC ISO instant. */
/**
 * Y-m-d of a Monday at least a week ahead in the location calendar, inside
 * the 90-day horizon: the fixture amenity opens on Mondays only and the
 * calendar disables closed weekdays.
 */
function nextWeekDate(): string {
  const lima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
  for (let days = 7; days < 14; days++) {
    const date = lima.format(new Date(Date.now() + days * 86_400_000))
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 1) return date
  }
  throw new Error('unreachable')
}

/** Y-m-d of tomorrow in Lima: the board shows one day and the fixtures book tomorrow. */
function tomorrowDate(): string {
  const lima = new Date(Date.now() - 5 * 3_600_000)
  lima.setUTCDate(lima.getUTCDate() + 1)

  return lima.toISOString().slice(0, 10)
}

function tomorrowAt(hour: number): string {
  const now = new Date()
  const lima = new Date(now.getTime() - 5 * 3_600_000)
  lima.setUTCDate(lima.getUTCDate() + 1)
  const date = lima.toISOString().slice(0, 10)

  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-05:00`).toISOString()
}

function reservation(overrides: Partial<ReservationSummary> = {}): ReservationSummary {
  return {
    id: 'res_1',
    account_id: 'acc_1',
    location_id: 'loc_1',
    amenity_id: 'am_1',
    amenity_name: 'Parrilla / terraza',
    unit_id: 'un_1',
    unit_number: 'Depto. 704',
    resident_id: null,
    resident_name: 'A. Torres',
    starts_at: tomorrowAt(19),
    ends_at: tomorrowAt(21),
    status: 'approved',
    is_completed: false,
    status_note: null,
    fee_snapshot: 50,
    deposit_snapshot: null,
    decided_at: null,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ...overrides,
  }
}

type CreateHandler = (body: unknown) => { status: number; data: unknown }

function installAdapter(
  reservations: ReservationSummary[],
  onTransition?: (url: string) => void,
  onCreate?: CreateHandler,
) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''

    if (url === '/api/me') {
      return Promise.resolve(axiosResponse(config, meResponse()))
    }

    if (url.includes('/availability?')) {
      return Promise.resolve(
        axiosResponse(config, {
          date: url.match(/date=([\d-]+)/)?.[1],
          slot_minutes: 60,
          booking_mode: 'approval',
          fee_amount: null,
          deposit_amount: null,
          slots: [
            { start: '10:00', end: '11:00', available: true, reason: null },
            { start: '11:00', end: '12:00', available: true, reason: null },
            { start: '12:00', end: '13:00', available: false, reason: 'taken' },
            { start: '13:00', end: '14:00', available: true, reason: null },
          ],
        }),
      )
    }

    if (url.includes('/amenities')) {
      return Promise.resolve(
        axiosResponse(config, {
          data: [
            {
              id: 'am_1',
              name: 'Parrilla / terraza',
              is_reservable: true,
              status: 'active',
              availability: { monday: [{ start: '09:00', end: '22:00' }] },
            },
          ],
        }),
      )
    }

    if (url.includes('/units')) {
      return Promise.resolve(
        axiosResponse(config, { data: [{ id: 'un_1', unit_number: 'Depto. 704' }] }),
      )
    }

    if (url.includes('/residents')) {
      return Promise.resolve(
        axiosResponse(config, { data: [{ id: 'rs_1', name: 'A. Torres' }] }),
      )
    }

    if (config.method === 'post' && url.endsWith('/reservations') && onCreate) {
      const result = onCreate(JSON.parse(config.data as string))

      if (result.status >= 400) {
        return Promise.reject({
          isAxiosError: true,
          config,
          response: axiosResponse(config, result.data, result.status),
        })
      }

      return Promise.resolve(axiosResponse(config, result.data, result.status))
    }

    if (/\/reservations\/[^/]+\/(approve|reject|observe|cancel)$/.test(url)) {
      onTransition?.(url)

      return Promise.resolve(axiosResponse(config, { data: reservation({ status: 'approved' }) }))
    }

    if (config.method === 'get' && /\/reservations\/[^/?]+$/.test(url)) {
      const id = url.split('/').pop()
      const found = reservations.find((candidate) => candidate.id === id) ?? reservations[0]

      return Promise.resolve(
        axiosResponse(config, {
          data: found,
          history: [
            { id: 'al_2', subject: 'reservation', event_type: 'reservation.approved', status: 'approved', previous_status: 'pending', note: null, category: null, amount: null, actor_name: 'Alejandra Admin', created_at: '2026-08-09T22:45:00Z' },
            { id: 'al_1', subject: 'reservation', event_type: 'reservation.created', status: 'pending', previous_status: null, note: null, category: null, amount: null, actor_name: 'A. Quispe', created_at: '2026-08-08T16:20:00Z' },
          ],
        }),
      )
    }

    if (url.includes('/reservations')) {
      return Promise.resolve(axiosResponse(config, { data: reservations }))
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <MantineProvider env="test">
      <Notifications autoClose={false} />
      <QueryClientProvider client={queryClient}>
        <ReservationsPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  for (const key of Object.keys(currentSearch)) {
    delete currentSearch[key]
  }
})

describe('ReservationsPage', () => {
  it('renders the day board blocks and the approval queue with pending requests', async () => {
    currentSearch.date = tomorrowDate()
    installAdapter([
      reservation(),
      reservation({
        id: 'res_2',
        amenity_id: 'am_2',
        amenity_name: 'Salón de eventos',
        unit_number: 'Depto. 501',
        resident_name: 'M. Paredes',
        status: 'pending',
        fee_snapshot: 150,
        deposit_snapshot: 300,
        starts_at: tomorrowAt(18),
        ends_at: tomorrowAt(23),
      }),
    ])

    renderPage()

    expect(await screen.findByText('Por aprobar')).toBeInTheDocument()
    // The pending request shows as a queue card with its fee line.
    await waitFor(() => {
      expect(screen.getByText(/cuota S\/ 150 \+ depósito S\/ 300/)).toBeInTheDocument()
    })
    expect(screen.getAllByText('Parrilla / terraza').length).toBeGreaterThan(0)
    expect(screen.getByText('Aprobar')).toBeInTheDocument()
    expect(screen.queryByText(/conflicto:/)).not.toBeInTheDocument()
    // Both bookings sit on the board as blocks in their amenity's row.
    expect(screen.getByRole('button', { name: 'Depto. 704 · A. Torres' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Depto. 501 · M. Paredes' })).toBeInTheDocument()
  })

  it('keeps overlapping requests actionable without a speculative conflict label', async () => {
    installAdapter([
      reservation({ starts_at: tomorrowAt(18), ends_at: tomorrowAt(20) }),
      reservation({
        id: 'res_2',
        status: 'pending',
        unit_number: 'Depto. 501',
        starts_at: tomorrowAt(19),
        ends_at: tomorrowAt(21),
      }),
    ])

    renderPage()

    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeEnabled()
    expect(screen.queryByText(/conflicto:/)).not.toBeInTheDocument()
  })

  it('approves a request from the queue', async () => {
    const transitions: string[] = []
    installAdapter(
      [reservation({ id: 'res_9', status: 'pending' })],
      (url) => transitions.push(url),
    )

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByText('Aprobar'))

    await waitFor(() => {
      expect(transitions).toContain('/api/accounts/acc_1/reservations/res_9/approve')
    })
  })

  it('requires a note to reject', async () => {
    const transitions: string[] = []
    installAdapter(
      [reservation({ id: 'res_9', status: 'pending' })],
      (url) => transitions.push(url),
    )

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByText('Rechazar'))

    const modal = await screen.findByRole('dialog')
    const confirm = within(modal).getByRole('button', { name: 'Rechazar' })
    expect(confirm).toBeDisabled()

    await user.type(modal.querySelector('textarea')!, 'Falta el depósito.')
    await user.click(confirm)

    await waitFor(() => {
      expect(transitions).toContain('/api/accounts/acc_1/reservations/res_9/reject')
    })
  })

  it('creates a reservation from the Nueva reserva drawer', async () => {
    const created: unknown[] = []
    installAdapter([], undefined, (body) => {
      created.push(body)

      return { status: 201, data: { data: reservation({ status: 'pending' }) } }
    })

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByText('Nueva reserva'))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('combobox', { name: 'Amenidad' }))
    await user.click(await screen.findByRole('option', { name: 'Parrilla / terraza' }))
    await user.click(within(drawer).getByRole('combobox', { name: 'Unidad' }))
    await user.click(await screen.findByRole('option', { name: 'Depto. 704' }))

    const date = nextWeekDate()
    await pickDate(user, within(drawer).getByRole('button', { name: /Fecha/ }), date)
    // Start = a free slot the server offered, on the grid; end = that slot's
    // end or the end of a consecutive free run (12:00 is taken, so 14:00 is
    // unreachable).
    // One slot per booking on the grid: picking a slot fixes the end; the
    // taken 12:00 slot renders disabled.
    expect(await within(drawer).findByRole('option', { name: '12:00–13:00' })).toBeDisabled()
    await user.click(within(drawer).getByRole('option', { name: '10:00–11:00' }))
    await user.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }))

    await waitFor(() => {
      expect(created).toEqual([
        {
          amenity_id: 'am_1',
          unit_id: 'un_1',
          resident_id: null,
          date,
          start: '10:00',
          end: '11:00',
        },
      ])
    })
  })

  it('maps a starts_at server error onto the start field', async () => {
    installAdapter([], undefined, () => ({
      status: 422,
      data: {
        message: 'Fuera de horario.',
        errors: { starts_at: ['El horario solicitado está fuera de la disponibilidad.'] },
      },
    }))

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByText('Nueva reserva'))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('combobox', { name: 'Amenidad' }))
    await user.click(await screen.findByRole('option', { name: 'Parrilla / terraza' }))
    await user.click(within(drawer).getByRole('combobox', { name: 'Unidad' }))
    await user.click(await screen.findByRole('option', { name: 'Depto. 704' }))
    await pickDate(user, within(drawer).getByRole('button', { name: /Fecha/ }), nextWeekDate())
    await user.click(await within(drawer).findByRole('option', { name: '10:00–11:00' }))
    await user.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }))

    expect(
      await screen.findByText('El horario solicitado está fuera de la disponibilidad.'),
    ).toBeInTheDocument()
  })

  it('caps the approval queue at three cards with an expand link', async () => {
    const pendings = [19, 17, 15, 13, 11].map((hour, index) =>
      reservation({
        id: `res_p${index}`,
        status: 'pending',
        starts_at: tomorrowAt(hour),
        ends_at: tomorrowAt(hour + 1),
      }),
    )
    installAdapter(pendings)

    renderPage()

    expect(await screen.findByText('Ver las 5 pendientes →')).toBeInTheDocument()
    expect(screen.getAllByText('Aprobar')).toHaveLength(3)

    const user = userEvent.setup()
    await user.click(screen.getByText('Ver las 5 pendientes →'))
    expect(screen.getAllByText('Aprobar')).toHaveLength(5)
    expect(screen.getByText('Ver menos')).toBeInTheDocument()
  })

  it('opens the detail drawer from a board block with facts, history and the cancel action', async () => {
    currentSearch.date = tomorrowDate()
    installAdapter([reservation({ starts_at: tomorrowAt(19), ends_at: tomorrowAt(21), created_by_name: 'A. Quispe' })])

    renderPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Depto. 704 · A. Torres' }))

    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByText('Reserva · Depto. 704 · A. Torres')).toBeInTheDocument()
    expect(within(drawer).getByText('Confirmada')).toBeInTheDocument()
    expect(within(drawer).getByText(/19:00–21:00/)).toBeInTheDocument()
    expect(within(drawer).getByText('Reserva aprobada')).toBeInTheDocument()
    expect(within(drawer).getByText('Reserva registrada')).toBeInTheDocument()
    // Approved bookings only offer cancel, behind a confirm step.
    expect(within(drawer).queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Cancelar reserva' }))
    expect(await screen.findByText('¿Cancelar la reserva?')).toBeInTheDocument()
  })

  it('shows the linked ledger rows in the drawer with their forward action', async () => {
    currentSearch.date = tomorrowDate()
    installAdapter([
      reservation({
        starts_at: tomorrowAt(19),
        ends_at: tomorrowAt(21),
        fee_snapshot: 50,
        deposit_snapshot: 300,
        movements: [
          {
            id: 'mv_fee',
            account_id: 'acc_1',
            location_id: 'loc_1',
            direction: 'income',
            category: 'reservation_fee',
            status: 'paid',
            allowed_transitions: ['pending'],
            amount: 50,
            concept: 'Cuota · Parrilla / terraza',
            detail: null,
            counterparty: null,
            unit_id: 'un_1',
            reservation_id: 'res_1',
            occurred_on: '2026-09-03',
            due_on: null,
            note: null,
            created_by: 'usr_1',
            settled_by: 'usr_1',
            settled_at: null,
            created_at: null,
          },
          {
            id: 'mv_dep',
            account_id: 'acc_1',
            location_id: 'loc_1',
            direction: 'income',
            category: 'reservation_deposit',
            status: 'held',
            allowed_transitions: ['to_refund', 'retained', 'pending'],
            amount: 300,
            concept: 'Depósito · Parrilla / terraza',
            detail: null,
            counterparty: null,
            unit_id: 'un_1',
            reservation_id: 'res_1',
            occurred_on: '2026-09-03',
            due_on: null,
            note: null,
            created_by: 'usr_1',
            settled_by: 'usr_1',
            settled_at: null,
            created_at: null,
          },
        ],
      }),
    ])

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Depto. 704 · A. Torres' }))

    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByText('Cobros')).toBeInTheDocument()
    expect(within(drawer).getByText('Pagado')).toBeInTheDocument()
    expect(within(drawer).getByText('En garantía')).toBeInTheDocument()
    // A settled fee links to Finanzas; a held deposit offers its forward move.
    expect(within(drawer).getByRole('link', { name: 'Ver en Finanzas →' })).toHaveAttribute(
      'href',
      '/admin/finances?month=2026-09&movement=mv_fee&page=1',
    )
    expect(within(drawer).getByRole('button', { name: 'Liberar depósito' })).toBeInTheDocument()
  })
})
