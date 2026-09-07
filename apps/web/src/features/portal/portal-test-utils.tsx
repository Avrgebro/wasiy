import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
import { ActiveUnitProvider } from './active-unit'

export function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

/** A resident with two units; Torre A · 402 is the primary contact's and therefore the default active unit. */
export const residentMe = {
  user: { id: 'usr_1', first_name: 'Carlos', last_name: 'Mendoza', name: 'Carlos Mendoza', email: 'carlos@x.pe' },
  accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, subscription: null }],
  active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, subscription: null },
  active_location: null,
  roles: { account: [], location: [] },
  accessible_locations: [],
  resident_memberships: [
    { resident_id: 'rs_1', unit_membership_id: 'um_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_402', unit_label: 'Torre A / 402', country: 'PE', is_primary_contact: true },
    { resident_id: 'rs_1', unit_membership_id: 'um_2', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_1203', unit_label: 'Torre B / 1203', country: 'PE', is_primary_contact: false },
  ],
}

export function renderPortal(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

  return render(
    <MantineProvider env="test">
      <Notifications autoClose={false} />
      <QueryClientProvider client={queryClient}>
        <ActiveUnitProvider>{ui}</ActiveUnitProvider>
      </QueryClientProvider>
    </MantineProvider>,
  )
}
