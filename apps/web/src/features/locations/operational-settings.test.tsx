import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../../i18n'
import type { OperationalSettingsValues, SettingsExplanation, SettingsResponse } from './api'
import { OperationalSettingsPanel } from './operational-settings'

const DEFAULTS: OperationalSettingsValues = {
  visitor_preregistration_enabled: true,
  visitor_auto_checkout_hours: 0,
  reservation_max_advance_days: 30,
  reservation_max_concurrent_per_unit: 2,
  reservation_cancellation_window_hours: 24,
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  announcements_location_manager_can_post: true,
  announcements_email_residents: false,
}

function settingsResponse(
  values: Partial<OperationalSettingsValues> = {},
  sources: Partial<Record<keyof OperationalSettingsValues, 'location' | 'account' | 'default'>> = {},
  accountValues: Partial<OperationalSettingsValues> = {},
): SettingsResponse {
  const merged = { ...DEFAULTS, ...values }
  const explanation = Object.fromEntries(
    (Object.keys(DEFAULTS) as (keyof OperationalSettingsValues)[]).map((key) => [
      key,
      {
        value: merged[key],
        source: sources[key] ?? 'default',
        account_value: accountValues[key] ?? merged[key],
      },
    ]),
  ) as SettingsExplanation

  return { data: { values: merged, explanation } }
}

function renderPanel({
  response,
  save = vi.fn(async () => settingsResponse()),
}: {
  response: SettingsResponse
  save?: (payload: unknown) => Promise<SettingsResponse>
}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })

  render(
    <MantineProvider env="test">
      <Notifications autoClose={false} />
      <QueryClientProvider client={queryClient}>
        <OperationalSettingsPanel
          fetchSettings={() => Promise.resolve(response)}
          level="location"
          saveSettings={save}
          scopeName="Edificio Central"
          settingsQueryKey={['test-settings']}
          timezone="America/Lima"
        />
      </QueryClientProvider>
    </MantineProvider>,
  )

  return { save }
}

describe('OperationalSettingsPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders effective values with defaults, never empty inputs', async () => {
    renderPanel({ response: settingsResponse() })

    expect(await screen.findByText('Visitas')).toBeInTheDocument()
    // Auto-checkout default 0 selects "Nunca".
    expect(screen.getByRole('button', { name: 'Nunca' })).toBeInTheDocument()
    expect(screen.getByLabelText('Días de anticipación máx.')).toHaveValue('30 días')
    expect(screen.getByLabelText('Ventana de cancelación')).toHaveValue('24 horas')
  })

  it('shows the effective and account values from the explanation', async () => {
    renderPanel({
      response: settingsResponse(
        { visitor_auto_checkout_hours: 12 },
        { visitor_auto_checkout_hours: 'location' },
        { visitor_auto_checkout_hours: 24 },
      ),
    })

    expect(
      await screen.findByText('En vigencia: 12 horas · valor de la cuenta: 24 horas'),
    ).toBeInTheDocument()
    expect(screen.getByText('· Restablecer al valor de la cuenta')).toBeInTheDocument()
  })

  it('saving one group sends only that group\'s touched keys', async () => {
    const { save } = renderPanel({ response: settingsResponse() })
    await screen.findByText('Visitas')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '12 h' }))

    const visitorsGroup = screen.getByText('Visitas').closest('section')!
    await user.click(within(visitorsGroup).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save).toHaveBeenCalledWith({ visitor_auto_checkout_hours: 12 })
  })

  it('clearing an override sends null and previews the inherited value', async () => {
    const { save } = renderPanel({
      response: settingsResponse(
        { visitor_auto_checkout_hours: 12 },
        { visitor_auto_checkout_hours: 'location' },
        { visitor_auto_checkout_hours: 24 },
      ),
    })
    await screen.findByText('Visitas')

    const user = userEvent.setup()
    await user.click(screen.getByText('· Restablecer al valor de la cuenta'))

    // The control previews the account value it will inherit.
    expect(screen.getByText('Al guardar, heredará el valor de la cuenta.')).toBeInTheDocument()

    const visitorsGroup = screen.getByText('Visitas').closest('section')!
    await user.click(within(visitorsGroup).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith({ visitor_auto_checkout_hours: null }))
  })

  it('discard resets a group without touching another', async () => {
    const { save } = renderPanel({ response: settingsResponse() })
    await screen.findByText('Visitas')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '8 h' }))

    const visitorsGroup = screen.getByText('Visitas').closest('section')!
    await user.click(within(visitorsGroup).getByRole('button', { name: 'Descartar' }))

    expect(within(visitorsGroup).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(save).not.toHaveBeenCalled()
  })

  it('enabling quiet hours stores explicit times', async () => {
    const { save } = renderPanel({ response: settingsResponse() })
    await screen.findByText('Horario de silencio')

    const user = userEvent.setup()
    const quietGroup = screen.getByText('Horario de silencio').closest('section')!
    await user.click(within(quietGroup).getByRole('switch'))
    await user.click(within(quietGroup).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        quiet_hours_enabled: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
      }),
    )
  })
})
