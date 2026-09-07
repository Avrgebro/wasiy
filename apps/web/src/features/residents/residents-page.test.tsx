import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { ADMIN_CAPABILITIES, FRONT_DESK_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { ResidentSummary } from './api'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1, search: '', portal: '', status: '' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useNavigate: () => navigateSpy, useSearch: () => currentSearch }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

const { ResidentsPage } = await import('./residents-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse(role: 'account_admin' | 'front_desk') {
  return {
    user: { id: 'usr_1', first_name: 'Alejandra', last_name: 'Admin', name: 'Alejandra Admin', email: 'admin@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', capabilities: role === 'account_admin' ? ADMIN_CAPABILITIES : FRONT_DESK_CAPABILITIES },
    roles:
      role === 'account_admin'
        ? { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] }
        : { account: [], location: [{ account_id: 'acc_1', location_id: 'loc_1', role: 'front_desk' }] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function person(overrides: Partial<ResidentSummary> = {}): ResidentSummary {
  return {
    id: 'rs_1', account_id: 'acc_1', user_id: 'u_1', first_name: 'Carlos', last_name: 'Mendoza', name: 'Carlos Mendoza',
    phone: '+51 987 654 321', email: 'carlos.mendoza@gmail.com', status: 'active', portal_state: 'active', active_membership_count: 2,
    memberships: [
      { id: 'um_1', unit_id: 'un_402', location_id: 'loc_1', status: 'active', is_primary_contact: true, unit: { id: 'un_402', unit_number: '402', building_name: 'Torre A', floor: '4' } },
      { id: 'um_2', unit_id: 'un_118', location_id: 'loc_1', status: 'active', is_primary_contact: false, unit: { id: 'un_118', unit_number: '118', building_name: 'Torre A', floor: '1' } },
    ],
    created_at: '2026-03-12T16:20:00Z',
    ...overrides,
  }
}

function installAdapter(role: 'account_admin' | 'front_desk', rows: ResidentSummary[], onWrite?: (url: string, body: unknown) => void) {
  const requests: string[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    requests.push(url)
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse(role)))
    if (config.method === 'post' || config.method === 'patch') {
      onWrite?.(url, config.data ? JSON.parse(config.data as string) : null)
      return Promise.resolve(axiosResponse(config, { data: rows[0] ?? person(), resident: {}, invitation: {} }, 201))
    }
    if (/\/residents\/[^/?]+$/.test(url)) {
      const id = url.split('/').pop()
      return Promise.resolve(axiosResponse(config, { data: rows.find((row) => row.id === id) ?? rows[0], history: [
        { id: 'al_1', event_type: 'package.received', summary: 'Paquete recibido para la unidad Torre A / 402.', actor_name: 'A. Quispe', created_at: '2026-08-15T15:24:00Z' },
      ] }))
    }
    if (url.includes('/units?')) return Promise.resolve(axiosResponse(config, { data: [{ id: 'un_402', unit_number: '402', building_name: 'Torre A' }] }))
    if (url.includes('/residents?')) {
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
      <Notifications autoClose={false} />
      <QueryClientProvider client={queryClient}>
        <ResidentsPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  for (const key of Object.keys(currentSearch)) delete currentSearch[key]
  Object.assign(currentSearch, { page: 1, search: '', portal: '', status: '' })
})

describe('ResidentsPage', () => {
  it('lists people with unit pills and phone, scoped to the location', async () => {
    const requests = installAdapter('account_admin', [
      person(),
      person({ id: 'rs_2', user_id: null, name: 'Rodrigo Salas', first_name: 'Rodrigo', last_name: 'Salas', email: null, phone: null, status: 'inactive', portal_state: 'not_invited', active_membership_count: 0, memberships: [] }),
    ])
    renderPage()

    expect(await screen.findByText('Carlos Mendoza')).toBeInTheDocument()
    expect(screen.getByText('2 personas · Edificio Central')).toBeInTheDocument()
    expect(screen.getByText('carlos.mendoza@gmail.com')).toBeInTheDocument()
    // Stored E.164, shown nationally because the viewer is in Peru.
    expect(screen.getByRole('link', { name: '987 654 321' })).toHaveAttribute('href', 'tel:+51987654321')
    expect(screen.getByText('402')).toBeInTheDocument()
    expect(screen.getByText('118')).toBeInTheDocument()
    expect(screen.queryByText('En el portal')).not.toBeInTheDocument()
    expect(screen.getAllByText('Sin unidad').length).toBeGreaterThan(0)
    expect(requests.some((url) => url.includes('/api/accounts/acc_1/residents?location_id=loc_1'))).toBe(true)
  })

  it('offers to search deactivated people when a name finds nobody in the active list', async () => {
    currentSearch.search = 'torres'
    installAdapter('account_admin', [])

    renderPage()

    expect(await screen.findByText('No hay resultados')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Buscar entre desactivados' }))
    expect(navigateSpy.mock.calls.at(-1)![0].search({ page: 2, search: 'torres' })).toEqual({ search: 'torres', status: 'inactive', page: 1 })
  })

  it('opens the person drawer, invites with an email asked at that moment, and blocks deactivation while housed', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter('account_admin', [person({ user_id: null, email: null, portal_state: 'not_invited' })], (url, body) => writes.push({ url, body }))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByText('Carlos Mendoza'))
    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByText(/Paquete recibido/)).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: /402 · Torre A/ })).toHaveAttribute('href', '/admin/units/$unitId')
    expect(within(drawer).getByRole('button', { name: 'Desactivar persona' })).toBeDisabled()

    await user.click(within(drawer).getByRole('button', { name: 'Invitar al portal' }))
    await user.type(within(drawer).getByLabelText('Correo del residente'), 'carlos@x.pe')
    await user.click(within(drawer).getByRole('button', { name: 'Enviar invitación' }))
    await waitFor(() => expect(writes).toEqual([{ url: '/api/residents/rs_1/invitations', body: { email: 'carlos@x.pe' } }]))
  })

  it('creates a person with names, phone and an optional unit — never an email', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter('account_admin', [], (url, body) => writes.push({ url, body }))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Nueva persona' }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).queryByLabelText(/Correo/)).not.toBeInTheDocument()
    await user.type(within(drawer).getByLabelText('Nombres'), 'Elena')
    await user.type(within(drawer).getByLabelText('Apellidos'), 'Vargas')
    await user.type(within(drawer).getByRole('textbox', { name: 'Teléfono (opcional)' }), '977105630')
    await user.click(within(drawer).getByRole('combobox', { name: 'Unidad' }))
    await user.click(await screen.findByRole('option', { name: 'Torre A / 402' }))
    await user.click(within(drawer).getByRole('button', { name: 'Crear persona' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body).toEqual({ first_name: 'Elena', last_name: 'Vargas', phone: '+51977105630', memberships: [{ unit_id: 'un_402', is_primary_contact: false }] })
  })

  it('shows front desk phones but no emails, no create button and no actions', async () => {
    installAdapter('front_desk', [person({ email: undefined })])
    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Carlos Mendoza')).toBeInTheDocument()
    expect(screen.queryByText(/gmail\.com/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva persona' })).not.toBeInTheDocument()
    await user.click(screen.getByText('Carlos Mendoza'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).queryByText('Correo')).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Editar datos' })).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Invitar al portal' })).not.toBeInTheDocument()
    // The unit page needs registry.manage, so the desk sees units as text, not links.
    expect(within(drawer).getByText('402 · Torre A')).toBeInTheDocument()
    expect(within(drawer).queryByRole('link', { name: /402/ })).not.toBeInTheDocument()
  })
})
