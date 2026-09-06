import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { ADMIN_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { FinanceSummary, MovementSummary } from './api'
import { formatMoney } from '../../lib/money'
import { shiftMonth } from './month'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1, search: '', category: '', sort: '' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({
      useNavigate: () => navigateSpy,
      useSearch: () => currentSearch,
    }),
    Link: ({ children, to, search }: { children: React.ReactNode; to: string; search?: Record<string, string> }) => (
      <a href={`${to}?${new URLSearchParams(search).toString()}`}>{children}</a>
    ),
  }
})

const { FinancesPage } = await import('./finances-page')

/** testing-library collapses the narrow no-break space to a plain one. */
const money = (...args: Parameters<typeof formatMoney>) => formatMoney(...args).replace(/\u202f/g, ' ')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: status === 200 ? 'OK' : 'Error' }
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

function summary(overrides: Partial<FinanceSummary> = {}): FinanceSummary {
  return {
    month: '2026-08',
    income_total: 1240,
    income_count: 17,
    income_by_category: [
      { category: 'reservation_fee', total: 1000, count: 14 },
      { category: 'fine', total: 160, count: 2 },
      { category: 'other_income', total: 80, count: 1 },
    ],
    expense_total: 3180,
    expense_count: 3,
    expense_by_category: [
      { category: 'cleaning', total: 1400, count: 1 },
      { category: 'electricity', total: 1180, count: 1 },
      { category: 'water', total: 600, count: 1 },
    ],
    balance: -1940,
    previous_month: '2026-07',
    previous_balance: -1520,
    receivable_total: 450,
    receivable_count: 3,
    payable_total: 600,
    payable_count: 1,
    deposits_held_total: 900,
    deposits_to_refund_total: 300,
    deposits_to_refund_count: 1,
    ...overrides,
  }
}

function movement(overrides: Partial<MovementSummary> = {}): MovementSummary {
  return {
    id: 'mv_1',
    account_id: 'acc_1',
    location_id: 'loc_1',
    direction: 'expense',
    category: 'water',
    status: 'pending',
    allowed_transitions: ['paid', 'voided'],
    amount: 600,
    concept: 'Agua · áreas comunes',
    detail: 'Recibo Sedapal · vence 20 ago',
    counterparty: 'Sedapal',
    unit_id: null,
    unit_number: null,
    reservation_id: null,
    occurred_on: '2026-08-16',
    due_on: '2026-08-20',
    note: null,
    created_by: 'usr_1',
    created_by_name: 'Alejandra Admin',
    settled_by: null,
    settled_by_name: null,
    settled_at: null,
    created_at: '2026-08-16T15:00:00Z',
    ...overrides,
  }
}

function installAdapter(
  rows: MovementSummary[],
  onTransition?: (url: string, body: unknown) => void,
  onRecord?: (body: unknown) => { status: number; data: unknown },
) {
  const requests: string[] = []

  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    requests.push(url)

    if (url === '/api/me') {
      return Promise.resolve(axiosResponse(config, meResponse()))
    }

    if (url.includes('/finances/summary')) {
      return Promise.resolve(axiosResponse(config, { data: summary() }))
    }

    if (config.method === 'get' && /\/finances\/movements\/[^/]+$/.test(url)) {
      const id = url.split('/').pop()
      const row = rows.find((candidate) => candidate.id === id) ?? movement()

      return Promise.resolve(
        axiosResponse(config, {
          data: row,
          history: [
            {
              id: 'al_2',
              event_type: 'movement.status_changed',
              status: row.status,
              previous_status: 'pending',
              actor_name: 'Alejandra Admin',
              created_at: '2026-08-12T15:14:00Z',
            },
            {
              id: 'al_1',
              event_type: 'movement.recorded',
              status: 'pending',
              previous_status: null,
              actor_name: 'Alejandra Admin',
              created_at: '2026-08-08T22:45:00Z',
            },
          ],
        }),
      )
    }

    if (/\/finances\/movements\/[^/]+\/status$/.test(url)) {
      onTransition?.(url, JSON.parse(config.data as string))

      return Promise.resolve(axiosResponse(config, { data: movement({ status: 'paid', allowed_transitions: ['pending'] }) }))
    }

    if (url.includes('/units')) {
      return Promise.resolve(
        axiosResponse(config, { data: [{ id: 'un_1', unit_number: 'Depto. 704', building_name: null }] }),
      )
    }

    if (config.method === 'post' && url.endsWith('/finances/dues')) {
      onRecord?.({ dues: JSON.parse(config.data as string) })

      return Promise.resolve(axiosResponse(config, { data: { created: 2, skipped: 1 } }))
    }

    if (config.method === 'post' && url.endsWith('/finances/movements') && onRecord) {
      const result = onRecord(JSON.parse(config.data as string))

      if (result.status >= 400) {
        return Promise.reject({
          isAxiosError: true,
          config,
          response: axiosResponse(config, result.data, result.status),
        })
      }

      return Promise.resolve(axiosResponse(config, result.data, result.status))
    }

    if (url.includes('/finances/movements')) {
      return Promise.resolve(
        axiosResponse(config, {
          data: rows,
          meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length },
        }),
      )
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })

  return requests
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <FinancesPage />
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
  Object.assign(currentSearch, { page: 1, search: '', category: '', sort: '' })
})

describe('FinancesPage', () => {
  it('renders the tiles and the month ledger rows', async () => {
    currentSearch.month = '2026-08'
    installAdapter([
      movement(),
      movement({
        id: 'mv_2',
        direction: 'income',
        category: 'reservation_deposit',
        status: 'to_refund',
        allowed_transitions: ['refunded', 'retained', 'held'],
        amount: 300,
        concept: 'Depósito · Salón de eventos',
        detail: 'Evento del dom 10 · sin incidencias · J. Ríos',
        counterparty: null,
        unit_id: 'un_1',
        unit_number: 'Depto. 302',
        occurred_on: '2026-08-12',
      }),
      movement({
        id: 'mv_3',
        status: 'paid',
        allowed_transitions: ['pending'],
        amount: 1180,
        concept: 'Luz · áreas comunes',
        counterparty: 'Luz del Sur',
        occurred_on: '2026-08-14',
      }),
    ])

    renderPage()

    expect(await screen.findByText(money(1240))).toBeInTheDocument()
    expect(screen.getByText(money(3180, { negative: true }))).toBeInTheDocument()
    expect(screen.getByText(money(-1940))).toBeInTheDocument()
    expect(screen.getByText('· S/ 900 en garantía')).toBeInTheDocument()
    // Pending chip carries receivable + payable counts.
    expect(screen.getByRole('button', { name: 'Pendientes 4' })).toBeInTheDocument()

    expect(screen.getByText('Agua · áreas comunes')).toBeInTheDocument()
    expect(screen.getByText('Sedapal')).toBeInTheDocument()
    expect(screen.getByText('Por pagar')).toBeInTheDocument()
    expect(screen.getByText('− S/ 600')).toBeInTheDocument()
    expect(screen.getByText('Depto. 302')).toBeInTheDocument()
    // No action column: the row itself is the way in.
    expect(screen.queryByRole('button', { name: 'Marcar devuelto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Detalle' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Depósito de reserva').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'agosto 2026' })).toBeInTheDocument()
    // Tile sublines are statistics, never claims.
    expect(screen.getByText('14 cuotas de reserva · 2 multas · 1 otro ingreso')).toBeInTheDocument()
    expect(screen.getByText(`Limpieza ${money(1400)} · Luz ${money(1180)} · Agua ${money(600)}`)).toBeInTheDocument()
    expect(screen.getByText(`vs. julio: ${money(-420)}`)).toBeInTheDocument()
    expect(screen.queryByText(/Se cubre con/)).not.toBeInTheDocument()
  })

  it('translates chips and month navigation into URL search params', async () => {
    currentSearch.month = '2026-08'
    const requests = installAdapter([movement()])

    renderPage()
    await screen.findByText('Agua · áreas comunes')

    await userEvent.click(screen.getByRole('button', { name: 'Egresos' }))
    expect(navigateSpy).toHaveBeenCalled()
    const chipUpdate = navigateSpy.mock.calls[0][0].search({ month: '2026-08', page: 3 })
    expect(chipUpdate).toEqual({ month: '2026-08', chip: 'expense', page: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    const monthUpdate = navigateSpy.mock.calls[1][0].search({ month: '2026-08', page: 1 })
    expect(monthUpdate.month).toBe(shiftMonth('2026-08', -1))

    expect(requests.some((url) => url.includes('/finances/movements?month=2026-08&page=1'))).toBe(true)
    expect(requests.some((url) => url.includes('/finances/summary?month=2026-08'))).toBe(true)
  })

  it('opens the row drawer with facts, history and actions, and applies the note to the action', async () => {
    currentSearch.month = '2026-08'
    const transitions: { url: string; body: unknown }[] = []
    installAdapter(
      [
        movement({
          id: 'mv_dep',
          direction: 'income',
          category: 'reservation_deposit',
          status: 'to_refund',
          allowed_transitions: ['refunded', 'retained', 'held'],
          amount: 300,
          concept: 'Depósito · Salón de eventos',
          detail: 'Evento del dom 10 · sin incidencias · J. Ríos',
          counterparty: null,
          unit_id: 'un_1',
          unit_number: 'Depto. 302',
          reservation_id: 'res_9',
          reservation: { id: 'res_9', amenity_name: 'Salón de eventos', starts_at: '2026-08-10T23:00:00Z', status: 'approved' },
          occurred_on: '2026-08-12',
          note: 'Sin incidencias durante el evento',
        }),
      ],
      (url, body) => transitions.push({ url, body }),
    )

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Depósito · Salón de eventos'))

    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Ingreso · Depósito de reserva')).toBeInTheDocument()
    expect(within(drawer).getByText('12 ago 2026')).toBeInTheDocument()
    expect(within(drawer).getByText('Sistema · al aprobar la reserva')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: /Salón de eventos/ })).toHaveAttribute(
      'href',
      '/admin/reservations?date=2026-08-10&reservation=res_9',
    )
    // History newest first, generated row attributed to the system.
    expect(await within(drawer).findByText('Marcado por devolver')).toBeInTheDocument()
    expect(within(drawer).getByText('Generado al aprobar la reserva')).toBeInTheDocument()
    expect(within(drawer).getByText('Sistema')).toBeInTheDocument()
    // Forward as primary, retain as secondary, revert as a text link.
    expect(within(drawer).getByRole('button', { name: 'No devolver' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Marcar recibido' })).toBeInTheDocument()

    await user.type(within(drawer).getByLabelText('Nota (opcional)'), 'Devuelto en efectivo')
    await user.click(within(drawer).getByRole('button', { name: 'Marcar devuelto' }))

    await waitFor(() => expect(transitions).toHaveLength(1))
    expect(transitions[0].url).toBe('/api/accounts/acc_1/finances/movements/mv_dep/status')
    expect(transitions[0].body).toEqual({ status: 'refunded', note: 'Devuelto en efectivo' })
    expect(await screen.findByText('Movimiento actualizado')).toBeInTheDocument()
  })

  it('records an expense from the drawer with the payload the API expects', async () => {
    currentSearch.month = '2026-08'
    const recorded: unknown[] = []
    installAdapter([], undefined, (body) => {
      recorded.push(body)

      return { status: 201, data: { data: movement() } }
    })

    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('combobox', { name: 'Categoría' }))
    await user.click(await screen.findByRole('option', { name: 'Agua' }))
    await user.type(within(drawer).getByLabelText('Monto'), '600')
    await user.type(within(drawer).getByLabelText('Concepto'), 'Agua · áreas comunes')
    await user.type(within(drawer).getByLabelText('Detalle'), 'Recibo Sedapal')
    await user.type(within(drawer).getByLabelText('Proveedor'), 'Sedapal')
    const occurredOn = within(drawer).getByLabelText('Fecha')
    await user.clear(occurredOn)
    await user.type(occurredOn, '2026-08-16')
    await user.type(within(drawer).getByLabelText('Vence'), '2026-08-20')
    await user.click(within(drawer).getByRole('button', { name: 'Registrar' }))

    await waitFor(() => {
      expect(recorded).toEqual([
        {
          direction: 'expense',
          category: 'water',
          status: 'pending',
          amount: 600,
          concept: 'Agua · áreas comunes',
          detail: 'Recibo Sedapal',
          counterparty: 'Sedapal',
          unit_id: null,
          occurred_on: '2026-08-16',
          due_on: '2026-08-20',
          note: null,
        },
      ])
    })
    expect(await screen.findByText('Movimiento registrado')).toBeInTheDocument()
  })

  it('switches to income fields and surfaces a server status error under its field', async () => {
    currentSearch.month = '2026-08'
    installAdapter([], undefined, () => ({
      status: 422,
      data: { message: 'Estado inválido.', errors: { status: ['Ese estado no aplica a este movimiento.'] } },
    }))

    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Registrar movimiento' }))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('radio', { name: 'Ingreso' }))
    expect(within(drawer).queryByLabelText('Proveedor')).not.toBeInTheDocument()
    await user.click(within(drawer).getByRole('combobox', { name: 'Categoría' }))
    await user.click(await screen.findByRole('option', { name: 'Depósito de reserva' }))
    await user.click(within(drawer).getByRole('combobox', { name: 'Unidad' }))
    await user.click(await screen.findByRole('option', { name: 'Depto. 704' }))
    // A deposit's settled option is "held", never "paid".
    await user.click(within(drawer).getByRole('combobox', { name: 'Estado inicial' }))
    await user.click(await screen.findByRole('option', { name: 'Ya recibido (en garantía)' }))
    await user.type(within(drawer).getByLabelText('Monto'), '300')
    await user.type(within(drawer).getByLabelText('Concepto'), 'Depósito · Salón')
    await user.click(within(drawer).getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText('Ese estado no aplica a este movimiento.')).toBeInTheDocument()
  })

  it('puts search, category filter and header sorting on the URL and the request', async () => {
    currentSearch.month = '2026-08'
    currentSearch.category = 'water,fine'
    currentSearch.sort = '-amount'
    const requests = installAdapter([movement()])

    renderPage()
    await screen.findByText('Agua · áreas comunes')
    const user = userEvent.setup()

    // Applied categories echo as chips; the request carries them.
    expect(screen.getByText('Categoría: Agua')).toBeInTheDocument()
    expect(screen.getByText('Categoría: Multa')).toBeInTheDocument()
    expect(requests.some((url) => url.includes('category=water%2Cfine') && url.includes('sort=-amount'))).toBe(true)

    await user.type(screen.getByPlaceholderText('Buscar concepto, detalle o proveedor…'), 'sedapal{Enter}')
    expect(navigateSpy.mock.calls.at(-1)![0].search({ month: '2026-08', page: 2 })).toMatchObject({ search: 'sedapal', page: 1 })

    // Monto is sorted desc: one more click clears it; Fecha starts ascending.
    await user.click(screen.getByRole('button', { name: 'Ordenado descendente, clic para quitar el orden' }))
    expect(navigateSpy.mock.calls.at(-1)![0].search({})).toMatchObject({ sort: '' })
    // Fecha is the first unsorted sortable header.
    await user.click(screen.getAllByRole('button', { name: 'Ordenar por esta columna' })[0])
    expect(navigateSpy.mock.calls.at(-1)![0].search({})).toMatchObject({ sort: 'occurred_on' })

    // Removing a chip drops only that category.
    await user.click(screen.getByRole('button', { name: 'Quitar filtro Categoría: Agua' }))
    expect(navigateSpy.mock.calls.at(-1)![0].search({})).toMatchObject({ category: 'fine' })
  })

  it('offers every allowed move for a held deposit: release, retain, and revert', async () => {
    currentSearch.month = '2026-08'
    installAdapter([
      movement({
        id: 'mv_held',
        direction: 'income',
        category: 'reservation_deposit',
        status: 'held',
        allowed_transitions: ['to_refund', 'retained', 'pending'],
        amount: 300,
        concept: 'Depósito · Salón de eventos',
        counterparty: null,
        unit_id: 'un_1',
        unit_number: 'Depto. 201',
      }),
    ])

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByText('Depósito · Salón de eventos'))
    const drawer = await screen.findByRole('dialog')

    expect(await within(drawer).findByRole('button', { name: 'Liberar depósito' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'No devolver' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Marcar pendiente' })).toBeInTheDocument()
  })

  it('asks before retaining a deposit and lets a retained one go back to held', async () => {
    currentSearch.month = '2026-08'
    const transitions: { url: string; body: unknown }[] = []
    installAdapter(
      [
        movement({
          id: 'mv_held',
          direction: 'income',
          category: 'reservation_deposit',
          status: 'held',
          allowed_transitions: ['to_refund', 'retained', 'pending'],
          amount: 300,
          concept: 'Depósito · Salón de eventos',
          counterparty: null,
          unit_id: 'un_1',
          unit_number: 'Depto. 201',
        }),
        movement({
          id: 'mv_kept',
          direction: 'income',
          category: 'reservation_deposit',
          status: 'retained',
          allowed_transitions: ['held'],
          amount: 300,
          concept: 'Depósito · Parrilla',
          counterparty: null,
          unit_id: 'un_1',
          unit_number: 'Depto. 101',
        }),
      ],
      (url, body) => transitions.push({ url, body }),
    )

    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByText('Depósito · Salón de eventos'))
    let drawer = await screen.findByRole('dialog')
    await user.click(await within(drawer).findByRole('button', { name: 'No devolver' }))
    // Nothing is sent until the confirm step.
    expect(transitions).toHaveLength(0)
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(transitions).toHaveLength(1))
    expect(transitions[0].body).toEqual({ status: 'retained' })
    await user.click(within(drawer).getByRole('button', { name: 'Cerrar' }))

    await user.click(await screen.findByText('Depósito · Parrilla'))
    drawer = await screen.findByRole('dialog')
    // Badge and history both carry the label.
    expect(await within(drawer).findAllByText('Retenido por daños')).not.toHaveLength(0)
    await user.click(within(drawer).getByRole('button', { name: 'Marcar recibido' }))
    await waitFor(() => expect(transitions).toHaveLength(2))
    expect(transitions[1].body).toEqual({ status: 'held' })
  })

  it('generates the month dues behind a confirmation and reports the counts', async () => {
    currentSearch.month = '2026-08'
    const posted: unknown[] = []
    installAdapter([movement()], undefined, (body) => {
      posted.push(body)

      return { status: 201, data: { data: movement() } }
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Generar cuotas del mes' }))
    expect(await screen.findByText('¿Generar las cuotas de agosto 2026?')).toBeInTheDocument()
    expect(posted).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(posted).toEqual([{ dues: { month: '2026-08' } }]))
    expect(await screen.findByText('2 cuotas generadas · 1 ya existían')).toBeInTheDocument()
  })
})
