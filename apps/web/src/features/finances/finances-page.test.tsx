import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { FinanceSummary, MovementSummary } from './api'
import { formatMoney } from '../../lib/money'
import { shiftMonth } from './month'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1 }

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
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima' },
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function summary(overrides: Partial<FinanceSummary> = {}): FinanceSummary {
  return {
    month: '2026-08',
    income_total: 1240,
    income_count: 14,
    expense_total: 3180,
    expense_count: 3,
    balance: -1940,
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
    category: 'utility',
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

    if (/\/finances\/movements\/[^/]+\/status$/.test(url)) {
      onTransition?.(url, JSON.parse(config.data as string))

      return Promise.resolve(axiosResponse(config, { data: movement({ status: 'paid', allowed_transitions: ['pending'] }) }))
    }

    if (url.includes('/units')) {
      return Promise.resolve(
        axiosResponse(config, { data: [{ id: 'un_1', unit_number: 'Depto. 704', building_name: null }] }),
      )
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
  currentSearch.page = 1
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
    expect(screen.getByRole('button', { name: 'Pendientes · 4' })).toBeInTheDocument()

    expect(screen.getByText('Agua · áreas comunes')).toBeInTheDocument()
    expect(screen.getByText('Sedapal')).toBeInTheDocument()
    expect(screen.getByText('Por pagar')).toBeInTheDocument()
    expect(screen.getByText('− S/ 600')).toBeInTheDocument()
    expect(screen.getByText('Depto. 302')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar devuelto' })).toBeInTheDocument()
    // A settled row offers the detail modal instead of a transition.
    expect(screen.getByRole('button', { name: 'Detalle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'agosto 2026' })).toBeInTheDocument()
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

  it('marks a pending row paid from the inline action', async () => {
    currentSearch.month = '2026-08'
    const transitions: { url: string; body: unknown }[] = []
    installAdapter([movement()], (url, body) => transitions.push({ url, body }))

    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar pagado' }))

    await waitFor(() => expect(transitions).toHaveLength(1))
    expect(transitions[0].url).toBe('/api/accounts/acc_1/finances/movements/mv_1/status')
    expect(transitions[0].body).toEqual({ status: 'paid' })
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
    await user.click(await screen.findByRole('option', { name: 'Servicios' }))
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
          category: 'utility',
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
})
