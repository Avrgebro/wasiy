import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { mantineTheme } from '../../app/theme'
import { sessionQueryKey } from '../auth/query-options'
import type { MeResponse, Session } from '../auth/types'
import type { Invoice } from './api'
import { ConfirmPaymentDrawer } from './confirm-payment-drawer'

const mocks = vi.hoisted(() => ({ uploadPaymentProof: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), uploadPaymentProof: mocks.uploadPaymentProof }))
vi.mock('@mantine/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@mantine/hooks')>()), useMediaQuery: () => true }))

const invoice: Invoice = { id: 'inv_1', number: 'F-2026-0042', period_starts_on: '2026-09-05', period_ends_on: '2026-10-04', amount_minor: 26000, currency: 'PEN', status: 'pending', due_on: '2026-09-05', paid_at: null, payment_method: null, rejection_reason: null, latest_proof: null }
const account = { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, subscription: null, access: { account_role: 'account_admin' as const, locations: [] } }
const me: MeResponse = { user: { id: 'u1', first_name: 'Ana', last_name: 'Torres', name: 'Ana Torres', email: 'ana.torres@wasiy.pe' }, accounts: [account], active_account: account, active_location: null, roles: { account: [], location: [] }, accessible_locations: [], resident_memberships: [] }

function renderDrawer(onClose = vi.fn()) {
  const queryClient = new QueryClient()
  const session: Session = { status: 'authenticated', me }
  queryClient.setQueryData(sessionQueryKey, session)
  render(
    <MantineProvider env="test" theme={mantineTheme}>
      <QueryClientProvider client={queryClient}><ConfirmPaymentDrawer invoice={invoice} onClose={onClose} /></QueryClientProvider>
    </MantineProvider>,
  )
  return onClose
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ConfirmPaymentDrawer', () => {
  it('needs a file, then uploads it with the optional details and shows the sent state', async () => {
    mocks.uploadPaymentProof.mockResolvedValue({ data: { id: 'p1' } })
    renderDrawer()
    const user = userEvent.setup()

    expect(await screen.findByText('Confirmar pago')).toBeInTheDocument()
    expect(screen.getByText(/F-2026-0042 · .*260\.00 · 5 set – 4 oct 2026/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Adjunta el comprobante para continuar.')

    const file = new File(['%PDF-1.4'], 'comprobante-bcp-5set.pdf', { type: 'application/pdf' })
    await user.upload(document.querySelector('input[type="file"]')!, file)
    expect(await screen.findByText('comprobante-bcp-5set.pdf')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Número de operación'), '00483921')
    await user.click(screen.getByRole('button', { name: 'Enviar comprobante' }))

    await waitFor(() => expect(mocks.uploadPaymentProof).toHaveBeenCalled())
    expect(mocks.uploadPaymentProof.mock.calls[0]?.[0]).toBe('inv_1')
    expect(mocks.uploadPaymentProof.mock.calls[0]?.[1]).toBe(file)
    expect(mocks.uploadPaymentProof.mock.calls[0]?.[2]).toEqual({ paid_on: undefined, amount_minor: undefined, operation_number: '00483921' })
    expect(await screen.findByText('Comprobante enviado')).toBeInTheDocument()
    expect(screen.getByText(/ana\.torres@wasiy\.pe/)).toBeInTheDocument()
  })

  it('lets the admin remove a chosen file and go back to the dropzone', async () => {
    renderDrawer()
    const user = userEvent.setup()
    await user.upload(document.querySelector('input[type="file"]')!, new File(['x'], 'yape.png', { type: 'image/png' }))
    expect(await screen.findByText('yape.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar archivo' }))
    expect(await screen.findByText('Arrastra el comprobante o toca para elegir')).toBeInTheDocument()
  })
})
