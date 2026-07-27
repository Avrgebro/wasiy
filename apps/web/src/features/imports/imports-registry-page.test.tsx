import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import { ImportsRegistryPage } from './imports-registry-page'

const originalAdapter = apiClient.defaults.adapter

function renderImportsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <ImportsRegistryPage />
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

function meResponse() {
  return {
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
    active_account: {
      id: 'acc_1',
      name: 'Wasiy Demo',
      slug: 'wasiy-demo',
      timezone: 'America/Lima',
    },
    active_location: {
      id: 'loc_1',
      account_id: 'acc_1',
      name: 'Edificio Central',
      slug: 'edificio-central',
      timezone: 'America/Lima',
      roles: ['location_manager'],
      access_source: 'location_role',
    },
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
    accessible_locations: [
      {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
    ],
    resident_memberships: [],
  }
}

function importSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'imp_1',
    account_id: 'acc_1',
    location_id: 'loc_1',
    requested_by_user_id: 'usr_1',
    import_type: 'registry_units_residents',
    status: 'ready_for_review',
    original_filename: 'registro.csv',
    total_rows: 2,
    valid_rows: 1,
    error_rows: 1,
    duplicate_rows: 0,
    warning_rows: 0,
    confirmed_at: null,
    completed_at: null,
    failed_at: null,
    failure_reason: null,
    created_at: '2026-06-21T05:00:00.000000Z',
    updated_at: '2026-06-21T05:00:00.000000Z',
    ...overrides,
  }
}

function rowsResponse(status: string | null = null) {
  const rows = [
    {
      id: 'row_1',
      registry_import_id: 'imp_1',
      account_id: 'acc_1',
      location_id: 'loc_1',
      row_number: 2,
      status: 'error',
      raw_data: { unidad: null, nombres: 'Ana' },
      normalized_data: { unit_number: null, first_name: 'Ana', last_name: 'Salas' },
      errors: ['El campo unidad es obligatorio.'],
      warnings: [],
      duplicate_key: null,
      committed_unit_id: null,
      committed_resident_id: null,
      committed_unit_membership_id: null,
    },
    {
      id: 'row_2',
      registry_import_id: 'imp_1',
      account_id: 'acc_1',
      location_id: 'loc_1',
      row_number: 3,
      status: 'warning',
      raw_data: { unidad: '301', nombres: 'Luis' },
      normalized_data: {
        unit_number: '301',
        building_name: 'Torre A',
        first_name: 'Luis',
        last_name: 'Rojas',
      },
      errors: [],
      warnings: ['La unidad existente sera reutilizada.'],
      duplicate_key: null,
      committed_unit_id: null,
      committed_resident_id: null,
      committed_unit_membership_id: null,
    },
  ]

  return {
    data: status ? rows.filter((row) => row.status === status) : rows,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: status ? rows.filter((row) => row.status === status).length : rows.length,
    },
  }
}

describe('ImportsRegistryPage', () => {
  afterEach(() => {
    cleanup()
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('renders import history, preview errors, and disables confirm while errors exist', async () => {
    apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
      if (config.url === '/api/me') {
        return Promise.resolve(axiosResponse(config, meResponse()))
      }

      if (config.url?.startsWith('/api/registry-imports?')) {
        return Promise.resolve(
          axiosResponse(config, {
            data: [importSummary()],
            meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
          }),
        )
      }

      if (config.url === '/api/registry-imports/imp_1') {
        return Promise.resolve(axiosResponse(config, { data: importSummary() }))
      }

      if (config.url?.startsWith('/api/registry-imports/imp_1/rows')) {
        return Promise.resolve(axiosResponse(config, rowsResponse(null)))
      }

      return Promise.resolve(axiosResponse(config, { message: 'Not found' }, 404))
    })

    renderImportsPage()

    expect(
      await screen.findByRole('heading', { name: 'Importaciones' }),
    ).toBeInTheDocument()
    expect(await screen.findAllByText('registro.csv')).toHaveLength(2)
    expect(await screen.findByText('El campo unidad es obligatorio.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled()
  })

  it('filters preview rows by status', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) => {
      if (config.url === '/api/me') {
        return Promise.resolve(axiosResponse(config, meResponse()))
      }

      if (config.url?.startsWith('/api/registry-imports?')) {
        return Promise.resolve(
          axiosResponse(config, {
            data: [importSummary()],
            meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
          }),
        )
      }

      if (config.url === '/api/registry-imports/imp_1') {
        return Promise.resolve(axiosResponse(config, { data: importSummary() }))
      }

      if (config.url?.startsWith('/api/registry-imports/imp_1/rows')) {
        const status = config.url.includes('status=warning') ? 'warning' : null

        return Promise.resolve(axiosResponse(config, rowsResponse(status)))
      }

      return Promise.resolve(axiosResponse(config, { message: 'Not found' }, 404))
    })
    apiClient.defaults.adapter = adapter
    const user = userEvent.setup()

    renderImportsPage()

    await screen.findByText('El campo unidad es obligatorio.')
    await user.click(screen.getByRole('radio', { name: 'Advertencias' }))

    await waitFor(() => {
      expect(
        adapter.mock.calls.some((call) =>
          call[0].url?.includes('/api/registry-imports/imp_1/rows?status=warning'),
        ),
      ).toBe(true)
    })
    expect(await screen.findByText('La unidad existente sera reutilizada.')).toBeInTheDocument()
  })

  it('uploads a csv file from the drawer', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) => {
      if (config.url === '/api/me') {
        return Promise.resolve(axiosResponse(config, meResponse()))
      }

      if (config.url?.startsWith('/api/registry-imports?')) {
        return Promise.resolve(
          axiosResponse(config, {
            data: [],
            meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
          }),
        )
      }

      if (config.url === '/api/locations/loc_1/registry-imports') {
        return Promise.resolve(axiosResponse(config, { data: importSummary() }, 201))
      }

      return Promise.resolve(axiosResponse(config, { data: importSummary() }))
    })
    apiClient.defaults.adapter = adapter
    const user = userEvent.setup()
    const file = new File(['unidad\n301\n'], 'registro.csv', { type: 'text/csv' })

    renderImportsPage()

    await user.click(await screen.findByRole('button', { name: 'Importar CSV' }))
    await user.upload(screen.getByLabelText('Archivo CSV'), file)
    await user.click(screen.getByRole('button', { name: 'Subir archivo' }))

    await waitFor(() => {
      const uploadCall = adapter.mock.calls.find(
        (call) => call[0].url === '/api/locations/loc_1/registry-imports',
      )

      expect(uploadCall?.[0].data).toBeInstanceOf(FormData)
      expect((uploadCall?.[0].data as FormData).get('file')).toBe(file)
    })
  })

  it('enables confirm when warnings are reviewable and refreshes registry queries', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) => {
      if (config.url === '/api/me') {
        return Promise.resolve(axiosResponse(config, meResponse()))
      }

      if (config.url?.startsWith('/api/registry-imports?')) {
        return Promise.resolve(
          axiosResponse(config, {
            data: [importSummary({ error_rows: 0, warning_rows: 1 })],
            meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
          }),
        )
      }

      if (config.url === '/api/registry-imports/imp_1') {
        return Promise.resolve(
          axiosResponse(config, { data: importSummary({ error_rows: 0, warning_rows: 1 }) }),
        )
      }

      if (config.url?.startsWith('/api/registry-imports/imp_1/rows')) {
        return Promise.resolve(axiosResponse(config, rowsResponse('warning')))
      }

      if (config.url === '/api/registry-imports/imp_1/confirm') {
        return Promise.resolve(
          axiosResponse(config, {
            data: importSummary({
              completed_at: '2026-06-21T05:01:00.000000Z',
              error_rows: 0,
              status: 'completed',
              warning_rows: 1,
            }),
          }),
        )
      }

      return Promise.resolve(axiosResponse(config, { data: importSummary() }))
    })
    apiClient.defaults.adapter = adapter
    const user = userEvent.setup()

    renderImportsPage()

    const confirmButton = await screen.findByRole('button', {
      name: 'Confirmar importación',
    })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    await waitFor(() => {
      expect(
        adapter.mock.calls.some(
          (call) =>
            call[0].url === '/api/registry-imports/imp_1/confirm' &&
            call[0].method === 'post',
        ),
      ).toBe(true)
    })
    expect(await screen.findByText('La unidad existente sera reutilizada.')).toBeInTheDocument()
  })
})
