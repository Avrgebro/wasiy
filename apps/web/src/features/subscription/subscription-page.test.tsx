import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { mantineTheme } from '../../app/theme'
import { sessionQueryKey } from '../auth/query-options'
import type { MeResponse, Session } from '../auth/types'
import type { SubscriptionPageData } from './api'
import { SubscriptionPage } from './subscription-page'

const mocks = vi.hoisted(() => ({ getSubscriptionPage: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), getSubscriptionPage: mocks.getSubscriptionPage }))

const account = { id: 'acc_1', name: 'Administradora Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, subscription: null, access: { account_role: 'account_admin' as const, locations: [] } }
const me: MeResponse = {
  user: { id: 'u1', first_name: 'Ana', last_name: 'Torres', name: 'Ana Torres', email: 'ana@wasiy.pe' },
  accounts: [account], active_account: account, active_location: null,
  roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] }, accessible_locations: [], resident_memberships: [],
}

function pageData(overrides: Partial<SubscriptionPageData> = {}): SubscriptionPageData {
  return {
    account: { id: 'acc_1', name: 'Administradora Horizonte' },
    plan: { code: 'operativo', name: 'Operativo', unit_price_minor: 650, currency: 'PEN', included_units: 10, features: ['Portal del residente', 'Reservas'] },
    subscription: { status: 'trialing', trial_ends_at: '2026-09-21T12:00:00Z', access_until: '2026-09-21T12:00:00Z', days_left: 5, is_lapsed: false, billable_units: 40, units_in_use: 37, pending_billable_units: null, pending_units_from: null, last_paid_at: null },
    breakdown: { base_units: 10, base_minor: 6500, extra_units: 30, extra_minor: 19500, total_minor: 26000 },
    invoices: [
      { id: 'i1', number: 'F-2026-0042', period_starts_on: '2026-09-21', period_ends_on: '2026-10-20', amount_minor: 26000, currency: 'PEN', status: 'pending', due_on: '2026-09-21', paid_at: null, payment_method: null, rejection_reason: null, latest_proof: null },
      { id: 'i2', number: 'F-2026-0039', period_starts_on: '2026-06-04', period_ends_on: '2026-07-03', amount_minor: 25350, currency: 'PEN', status: 'rejected', due_on: '2026-06-04', paid_at: null, payment_method: null, rejection_reason: 'El monto no coincide con la factura.', latest_proof: null },
      { id: 'i3', number: 'F-2026-0040', period_starts_on: '2026-07-04', period_ends_on: '2026-08-03', amount_minor: 25350, currency: 'PEN', status: 'paid', due_on: '2026-07-04', paid_at: '2026-07-06T15:00:00Z', payment_method: 'transfer', rejection_reason: null, latest_proof: null },
    ],
    payment_instructions: { transfer: { bank: 'BCP', account_type: 'Cuenta corriente soles', account_number: '193-2547891-0-45', cci: '002-193-002547891045-19', holder: 'Wasiy SAC', tax_id: '20612345678' }, yape: { number: '987 654 321', holder: 'Wasiy SAC' }, plin: null },
    plans: [
      { code: 'esencial', name: 'Esencial', unit_price_minor: 450, included_units: 10, features: ['Visitantes'], total_minor: 18000, is_current: false },
      { code: 'operativo', name: 'Operativo', unit_price_minor: 650, included_units: 10, features: ['Reservas'], total_minor: 26000, is_current: true },
    ],
    contact_email: 'hola@wasiy.co',
    ...overrides,
  }
}

function renderPage(data: SubscriptionPageData | null, onConfirmPayment = vi.fn()) {
  mocks.getSubscriptionPage.mockResolvedValue({ data })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const session: Session = { status: 'authenticated', me }
  queryClient.setQueryData(sessionQueryKey, session)
  render(
    <MantineProvider env="test" theme={mantineTheme}>
      <QueryClientProvider client={queryClient}><SubscriptionPage onConfirmPayment={onConfirmPayment} /></QueryClientProvider>
    </MantineProvider>,
  )
  return onConfirmPayment
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

const card = (title: string) => screen.getByRole('heading', { level: 2, name: title }).closest('section')!

describe('SubscriptionPage', () => {
  it('reads the trial state with a pending invoice and shows contracted units, not counted ones', async () => {
    renderPage(pageData())

    expect(await screen.findByText('Prueba gratis')).toBeInTheDocument()
    expect(screen.getByText('Termina el 21 de setiembre')).toBeInTheDocument()
    expect(screen.getByText('Quedan 5 días. Tienes una factura pendiente.')).toBeInTheDocument()
    const billing = card('Facturación')
    expect(within(billing).getByText('unidades contratadas').previousSibling).toHaveTextContent('40')
    expect(within(billing).getByText('en uso').previousSibling).toHaveTextContent('37')
    expect(within(billing).getByText('Te quedan 3 unidades disponibles')).toBeInTheDocument()
    // Intl separates the currency with a no-break space; match the digits.
    expect(within(billing).getByText(/260\.00/)).toBeInTheDocument()
    expect(within(card('Cómo pagar')).getByText('F-2026-0042')).toBeInTheDocument()
  })

  it('lists invoices with their state and offers Confirmar pago on pending and rejected ones', async () => {
    const onConfirm = renderPage(pageData())
    const invoices = await screen.findByRole('heading', { level: 2, name: 'Facturas' })
    const rows = within(invoices.closest('section')!).getAllByRole('listitem')

    expect(rows.map((row) => row.dataset.invoice)).toEqual(['F-2026-0042', 'F-2026-0039', 'F-2026-0040'])
    expect(within(rows[0]!).getByText('Pendiente')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('El monto no coincide con la factura.')).toBeInTheDocument()
    expect(within(rows[2]!).getByText(/Pagada el/)).toBeInTheDocument()
    expect(within(rows[2]!).queryByRole('button')).not.toBeInTheDocument()

    within(rows[1]!).getByRole('button', { name: 'Confirmar pago' }).click()
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ number: 'F-2026-0039' }))
  })

  it('prices the plan comparison for the contracted units and marks the current one', async () => {
    renderPage(pageData())
    const change = (await screen.findByRole('heading', { level: 2, name: 'Cambiar de plan' })).closest('section')!

    expect(within(change).getByText('Totales calculados para las 40 unidades contratadas.')).toBeInTheDocument()
    expect(within(change).getByText('Plan actual')).toBeInTheDocument()
    expect(within(change).getByRole('link', { name: 'Solicitar cambio' })).toHaveAttribute('href', expect.stringContaining('mailto:hola@wasiy.co'))
  })

  it('shows the lapsed state with the button down to the invoice, and the empty invoice state', async () => {
    renderPage(pageData({ subscription: { ...pageData().subscription, status: 'expired', is_lapsed: true, days_left: 0, access_until: '2026-09-05T12:00:00Z' } }))
    expect(await screen.findByText('El acceso está pausado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver factura pendiente' })).toBeInTheDocument()
    cleanup()

    renderPage(pageData({ invoices: [] }))
    expect(await screen.findByText('Todavía no hay pagos registrados.')).toBeInTheDocument()
    expect(screen.queryByText('Indica esta referencia en el pago')).not.toBeInTheDocument()
  })
})
