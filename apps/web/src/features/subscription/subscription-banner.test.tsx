import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import '../../i18n'
import { mantineTheme } from '../../app/theme'
import { sessionQueryKey } from '../auth/query-options'
import type { MeResponse, Session, SubscriptionSummary } from '../auth/types'
import { SubscriptionBanner } from './subscription-banner'

const subscription: SubscriptionSummary = {
  status: 'trialing',
  plan: { code: 'operativo', name: 'Operativo' },
  unit_price_minor: 650,
  billable_units: 40,
  currency: 'PEN',
  trial_ends_at: '2026-09-21T12:00:00Z',
  access_until: '2026-09-21T12:00:00Z',
  days_left: 14,
  is_lapsed: false,
  contact_email: 'hola@wasiy.co',
}

function makeMe(overrides: Partial<SubscriptionSummary> | null, admin = true): MeResponse {
  const account = { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, subscription: overrides === null ? null : { ...subscription, ...overrides } }
  return {
    user: { id: 'usr_1', first_name: 'Ana', last_name: 'Salas', name: 'Ana Salas', email: 'ana@wasiy.test' },
    accounts: [account],
    active_account: account,
    active_location: null,
    roles: { account: admin ? [{ account_id: 'acc_1', role: 'account_admin' }] : [], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

async function renderBanner(me: MeResponse) {
  const queryClient = new QueryClient()
  const session: Session = { status: 'authenticated', me }
  queryClient.setQueryData(sessionQueryKey, session)
  const rootRoute = createRootRoute({ component: SubscriptionBanner })
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/admin'] }) })
  render(
    <MantineProvider theme={mantineTheme} env="test">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  )
  await router.load()
}

afterEach(cleanup)

describe('SubscriptionBanner', () => {
  it('stays quiet through the first week of the trial', async () => {
    await renderBanner(makeMe({ days_left: 8 }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('counts down the last week and links admins to the subscription page', async () => {
    await renderBanner(makeMe({ days_left: 5 }))
    expect(await screen.findByText(/^Tu prueba gratis termina el 21 se/)).toBeInTheDocument()
    expect(screen.getByText(/Quedan 5 días/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver suscripción' })).toHaveAttribute('href', '/admin/subscription')
  })

  it('tells non-admin staff who can act once the account lapses, without a link', async () => {
    await renderBanner(makeMe({ status: 'expired', days_left: 0, is_lapsed: true }, false))
    expect(await screen.findByText(/^Tu suscripción venció el 21 se/)).toBeInTheDocument()
    expect(screen.getByText(/Avisa al administrador/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders nothing for accounts without a subscription', async () => {
    await renderBanner(makeMe(null))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
