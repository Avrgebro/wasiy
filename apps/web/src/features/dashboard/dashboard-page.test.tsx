import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import { DashboardPage } from './dashboard-page'

const originalAdapter = apiClient.defaults.adapter

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

function axiosResponse(
  config: AxiosResponse['config'],
  data: unknown,
  status = 200,
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status === 200 ? 'OK' : 'Error',
  }
}

describe('DashboardPage', () => {
  beforeEach(() => {
    apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
      if (config.url === '/api/me') {
        return Promise.resolve(
          axiosResponse(config, {
            user: {
              id: 'usr_1',
              first_name: 'Mariana',
              last_name: 'Rojas',
              name: 'Mariana Rojas',
              email: 'manager@wasiy.test',
            },
            accounts: [
              {
                id: 'acc_1',
                name: 'Wasiy Demo',
                slug: 'wasiy-demo',
                timezone: 'America/Lima',
              },
            ],
            active_account: null,
            roles: {
              account: [],
              location: [
                {
                  account_id: 'acc_1',
                  location_id: 'loc_1',
                  role: 'location_manager',
                },
              ],
            },
            assigned_locations: [
              {
                id: 'loc_1',
                account_id: 'acc_1',
                name: 'Edificio Central',
                slug: 'edificio-central',
                timezone: 'America/Lima',
                role: 'location_manager',
              },
            ],
            resident_memberships: [],
          }),
        )
      }

      if (config.url === '/api/locations/loc_1/dashboard') {
        return Promise.resolve(
          axiosResponse(config, {
            location: {
              id: 'loc_1',
              account_id: 'acc_1',
              name: 'Edificio Central',
              slug: 'edificio-central',
              timezone: 'America/Lima',
            },
            metrics: {
              assigned_staff_count: 1,
            },
          }),
        )
      }

      return Promise.resolve(axiosResponse(config, { message: 'Not found' }, 404))
    })
  })

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('renders the assigned location dashboard metric from the api', async () => {
    renderDashboard()

    expect(
      await screen.findByRole('heading', {
        name: 'Operación de Edificio Central',
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Personal asignado')).toBeInTheDocument()
    expect(await screen.findByText('1')).toBeInTheDocument()
  })
})
