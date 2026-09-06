import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { FRONT_DESK_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { PackageSummary } from './api'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1, search: '', chip: 'pending' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useNavigate: () => navigateSpy, useSearch: () => currentSearch }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

const { PackagesPage } = await import('./packages-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse() {
  return {
    user: { id: 'usr_1', first_name: 'Ana', last_name: 'Quispe', name: 'Ana Quispe', email: 'desk@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', capabilities: FRONT_DESK_CAPABILITIES },
    roles: { account: [], location: [{ account_id: 'acc_1', location_id: 'loc_1', role: 'front_desk' }] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function pkg(overrides: Partial<PackageSummary> = {}): PackageSummary {
  return {
    id: 'pk_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_402', unit_number: '402', building_name: 'Torre A',
    resident_id: 'rs_1', resident_name: 'Carlos Mendoza', notes: 'Caja mediana, frágil', status: 'pending',
    received_at: '2026-08-15T15:24:00Z', received_by_name: 'A. Quispe', delivered_at: null, delivered_by_name: null, delivery_notes: null,
    notified_email: 'carlos@x.pe', ...overrides,
  }
}

function installAdapter(rows: PackageSummary[], onWrite?: (url: string, body: unknown) => void) {
  const requests: string[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    requests.push(url)
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse()))
    if (config.method === 'post') {
      onWrite?.(url, JSON.parse(config.data as string))
      return Promise.resolve(axiosResponse(config, { data: pkg({ status: url.endsWith('/deliver') ? 'delivered' : 'pending' }) }, 201))
    }
    if (url.includes('/units?')) return Promise.resolve(axiosResponse(config, { data: [{ id: 'un_402', unit_number: '402', building_name: 'Torre A' }] }))
    if (url.includes('/residents?')) return Promise.resolve(axiosResponse(config, { data: [{ id: 'rs_1', name: 'Carlos Mendoza' }] }))
    if (url.includes('/packages')) {
      return Promise.resolve(axiosResponse(config, { data: rows, meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length } }))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  return requests
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <PackagesPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
})

describe('PackagesPage', () => {
  it('lists packages with the pending count and opens a row drawer that delivers', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter([pkg(), pkg({ id: 'pk_2', unit_number: '501', resident_id: null, resident_name: null, notes: 'Sobre acolchado', notified_email: 'primary@x.pe' })], (url, body) => writes.push({ url, body }))

    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Caja mediana, frágil')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'En recepción 2' })).toBeInTheDocument()
    expect(screen.getAllByText('Contacto principal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('15 ago · 10:24').length).toBeGreaterThan(0)

    await user.click(screen.getByText('Caja mediana, frágil'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Aviso enviado a carlos@x.pe')).toBeInTheDocument()
    expect(within(drawer).getByText('Paquete recibido')).toBeInTheDocument()
    await user.type(within(drawer).getByLabelText('Notas de entrega (opcional)'), 'Lo retiró Laura Mendoza')
    await user.click(within(drawer).getByRole('button', { name: 'Marcar entregado' }))

    await waitFor(() => expect(writes).toEqual([{ url: '/api/packages/pk_1/deliver', body: { delivery_notes: 'Lo retiró Laura Mendoza' } }]))
    expect(await screen.findByText('Paquete entregado')).toBeInTheDocument()
  })

  it('registers a package with unit, optional person and notes', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter([], (url, body) => writes.push({ url, body }))

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Registrar paquete' }))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('combobox', { name: /Unidad/ }))
    await user.click(await screen.findByRole('option', { name: 'Torre A / 402' }))
    await user.click(within(drawer).getByRole('combobox', { name: 'Para' }))
    await user.click(await screen.findByRole('option', { name: 'Carlos Mendoza' }))
    await user.type(within(drawer).getByLabelText('Notas'), 'Caja mediana, frágil')
    await user.click(within(drawer).getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(writes).toEqual([{ url: '/api/locations/loc_1/packages', body: { unit_id: 'un_402', resident_id: 'rs_1', notes: 'Caja mediana, frágil' } }]))
    expect(await screen.findByText('Paquete registrado · aviso enviado a carlos@x.pe')).toBeInTheDocument()
  })
})
