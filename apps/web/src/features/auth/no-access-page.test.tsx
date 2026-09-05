import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return { ...actual, useRouter: () => ({ navigate: vi.fn() }) }
})

const { NoAccessPage } = await import('./no-access-page')

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
})

describe('NoAccessPage (staff build)', () => {
  it('points a resident-only user at the portal host instead of looping', async () => {
    apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve({
        config,
        data: {
          user: { id: 'usr_1', first_name: 'Carlos', last_name: 'Mendoza', name: 'Carlos Mendoza', email: 'c@x.pe' },
          accounts: [], active_account: null, active_location: null, roles: { account: [], location: [] }, accessible_locations: [],
          resident_memberships: [{ resident_id: 'rs_1', unit_membership_id: 'um_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_1', unit_label: '402', country: 'PE', is_primary_contact: true }],
        },
        headers: {}, status: 200, statusText: 'OK',
      } as AxiosResponse),
    )
    render(
      <MantineProvider env="test">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <NoAccessPage />
        </QueryClientProvider>
      </MantineProvider>,
    )

    const link = await screen.findByRole('link', { name: 'Ir al portal de residentes' })
    expect(link).toHaveAttribute('href', 'http://localhost:5175')
    expect(screen.getByText('Tu acceso es al portal de residentes, no a la aplicación del personal.')).toBeInTheDocument()
  })
})
