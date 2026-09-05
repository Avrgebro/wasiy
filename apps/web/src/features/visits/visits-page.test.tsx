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
import type { VisitSummary } from './api'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1, search: '', chip: 'inside', confirmation: '' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useNavigate: () => navigateSpy, useSearch: () => currentSearch }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

const { VisitsPage } = await import('./visits-page')

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

function visit(overrides: Partial<VisitSummary> = {}): VisitSummary {
  return {
    id: 'vs_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_402', unit_number: '402', building_name: 'Torre A',
    resident_id: 'rs_1', resident_name: 'Carlos Mendoza', resident_phone: '+51 987 654 321', visitor_name: 'Elena Vargas', document: 'DNI 45872213', phone: null,
    confirmation: 'intercom', notes: 'Madre del residente', status: 'inside', checked_in_at: new Date(Date.now() - 2 * 3_600_000 - 12 * 60_000).toISOString(),
    checked_in_by_name: 'A. Quispe', checked_out_at: null, checked_out_by_name: null, checkout_notes: null, auto_checked_out: false, ...overrides,
  }
}

function installAdapter(rows: VisitSummary[], onWrite?: (url: string, body: unknown) => void) {
  const requests: string[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    requests.push(url)
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse()))
    if (config.method === 'post') {
      onWrite?.(url, JSON.parse(config.data as string))
      return Promise.resolve(axiosResponse(config, { data: visit({ status: url.endsWith('/check-out') ? 'left' : 'inside' }) }, 201))
    }
    if (url.includes('/units?')) return Promise.resolve(axiosResponse(config, { data: [{ id: 'un_402', unit_number: '402', building_name: 'Torre A' }] }))
    if (url.includes('/residents?')) {
      return Promise.resolve(axiosResponse(config, { data: [{ id: 'rs_1', name: 'Carlos Mendoza', phone: '+51 987 654 321', memberships: [{ id: 'um_1', unit_id: 'un_402', location_id: 'loc_1', status: 'active', is_primary_contact: true }] }] }))
    }
    if (url.includes('/visits')) {
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
        <VisitsPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
})

describe('VisitsPage', () => {
  it('lists visits inside with counts, opens the drawer with the live duration and checks out with notes', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter([visit(), visit({ id: 'vs_2', visitor_name: 'Delivery Rappi', document: null, resident_id: null, resident_name: null, confirmation: 'none' })], (url, body) => writes.push({ url, body }))
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Elena Vargas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dentro · 2' })).toBeInTheDocument()
    expect(screen.getByText('DNI 45872213')).toBeInTheDocument()
    expect(screen.getByText('Unidad 402')).toBeInTheDocument()
    expect(screen.getByText('Intercom')).toBeInTheDocument()

    await user.click(screen.getByText('Elena Vargas'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('2 h 12 min')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: '987 654 321' })).toHaveAttribute('href', 'tel:+51987654321')
    expect(within(drawer).getByText('Confirmada por Intercom con Carlos Mendoza')).toBeInTheDocument()
    await user.type(within(drawer).getByLabelText('Notas de salida (opcional)'), 'Se retira con paquete')
    await user.click(within(drawer).getByRole('button', { name: 'Marcar salida' }))

    await waitFor(() => expect(writes).toEqual([{ url: '/api/visits/vs_1/check-out', body: { notes: 'Se retira con paquete' } }]))
    expect(await screen.findByText('Salida registrada')).toBeInTheDocument()
  })

  it('registers a walk-in with unit, host, confirmation and notes, showing the primary contact to call', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter([], (url, body) => writes.push({ url, body }))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Registrar visita' }))
    const drawer = await screen.findByRole('dialog')
    await user.type(within(drawer).getByLabelText('Nombre'), 'Elena Vargas')
    await user.type(within(drawer).getByLabelText('Documento (opcional)'), 'DNI 45872213')
    await user.click(within(drawer).getByRole('combobox', { name: /Unidad/ }))
    await user.click(await screen.findByRole('option', { name: 'Torre A / 402' }))
    expect(await within(drawer).findByText(/Contacto principal: Carlos Mendoza/)).toBeInTheDocument()
    await user.click(within(drawer).getByRole('combobox', { name: 'Recibe' }))
    await user.click(await screen.findByRole('option', { name: 'Carlos Mendoza' }))
    await user.click(within(drawer).getByRole('radio', { name: 'Intercom' }))
    await user.type(within(drawer).getByLabelText('Notas'), 'Madre del residente')
    await user.click(within(drawer).getByRole('button', { name: 'Registrar ingreso' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].url).toBe('/api/locations/loc_1/visits')
    expect(writes[0].body).toEqual({ visitor_name: 'Elena Vargas', unit_id: 'un_402', resident_id: 'rs_1', document: 'DNI 45872213', phone: null, confirmation: 'intercom', notes: 'Madre del residente' })
  })
})
