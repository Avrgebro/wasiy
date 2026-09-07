import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import { mantineTheme } from '../../app/theme'
import type { SubscriptionPageData } from './api'
import { ChangeUnitsDrawer } from './change-units-drawer'

const mocks = vi.hoisted(() => ({ updateContractedUnits: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), updateContractedUnits: mocks.updateContractedUnits }))
vi.mock('@mantine/hooks', async (importOriginal) => ({ ...(await importOriginal<typeof import('@mantine/hooks')>()), useMediaQuery: () => true }))

const data: SubscriptionPageData = {
  account: { id: 'acc_1', name: 'Horizonte' },
  plan: { code: 'operativo', name: 'Operativo', unit_price_minor: 650, currency: 'PEN', included_units: 10, features: [] },
  subscription: { status: 'active', trial_ends_at: '2026-08-21T12:00:00Z', access_until: '2026-10-20T23:59:59Z', days_left: 36, is_lapsed: false, billable_units: 40, units_in_use: 37, pending_billable_units: null, pending_units_from: null, last_paid_at: null, requested_plan: null, plan_change_requested_at: null },
  breakdown: { base_units: 10, base_minor: 6500, extra_units: 30, extra_minor: 19500, total_minor: 26000 },
  invoices: [], payment_instructions: null, plans: [], contact_email: 'hola@wasiy.co',
}

function renderDrawer() {
  const onClose = vi.fn()
  render(
    <MantineProvider env="test" theme={mantineTheme}>
      <QueryClientProvider client={new QueryClient()}><ChangeUnitsDrawer data={data} onClose={onClose} opened /></QueryClientProvider>
    </MantineProvider>,
  )
  return onClose
}

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('ChangeUnitsDrawer', () => {
  it('prices the new number and explains when it applies, then saves', async () => {
    mocks.updateContractedUnits.mockResolvedValue({ data })
    const onClose = renderDrawer()
    const user = userEvent.setup()

    const input = screen.getByLabelText('Unidades contratadas')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await user.clear(input)
    await user.type(input, '50')
    expect(screen.getByText('Total mensual con 50 unidades')).toBeInTheDocument()
    expect(screen.getByText(/325\.00/)).toBeInTheDocument()
    expect(screen.getByText('Se aplica ahora. La diferencia se cobra en la próxima factura.')).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '38')
    expect(screen.getByText('Se aplica desde la próxima renovación, el 20 de octubre.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(mocks.updateContractedUnits.mock.calls[0]?.[0]).toBe(38))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
