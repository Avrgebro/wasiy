import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { HouseholdMember, LedgerResponse, PortalVehicle } from './api'

const navigateSpy = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useRouterState: () => '/portal/mi-unidad',
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

const { axiosResponse, renderPortal, residentMe } = await import('./portal-test-utils')
const { PortalMyUnitPage } = await import('./portal-my-unit-page')
const { PortalLedgerPage } = await import('./portal-ledger-page')
const { PortalProfilePage } = await import('./portal-profile-page')

const originalAdapter = apiClient.defaults.adapter

const carlos: HouseholdMember = { membership_id: 'um_1', resident_id: 'rs_1', first_name: 'Carlos', last_name: 'Mendoza', name: 'Carlos Mendoza', phone: '+51987654321', resident_type: 'owner', is_primary_contact: true, is_me: true, portal_state: 'active', status: 'active', started_at: '2024-03-01' }
const rosa: HouseholdMember = { membership_id: 'um_3', resident_id: 'rs_3', first_name: 'Rosa', last_name: 'Quintana', name: 'Rosa Quintana', phone: '+51951330470', resident_type: 'occupant', is_primary_contact: false, is_me: false, portal_state: 'invited', status: 'active', started_at: '2025-03-10' }
const yaris: PortalVehicle = { id: 'vh_1', unit_id: 'un_402', vehicle_type: 'car', plate: 'ABC-123', make: 'Toyota', model: 'Yaris', color: 'blanco', status: 'active' }
const ledger: LedgerResponse = {
  data: [
    { id: 'fm_1', concept: 'Cuota de mantenimiento', detail: null, category: 'maintenance_dues', occurred_on: '2026-09-01', period: '2026-09', amount: 250, state: 'pending' },
    { id: 'fm_2', concept: 'Reserva · Salón de eventos', detail: null, category: 'reservation_fee', occurred_on: '2026-09-04', period: null, amount: 70, state: 'pending' },
    { id: 'fm_3', concept: 'Depósito devuelto', detail: null, category: 'reservation_deposit', occurred_on: '2026-08-18', period: null, amount: -100, state: 'paid' },
  ],
  balance: 320,
  pending_count: 2,
  last_dues: { period: '2026-09', amount: 250, settled: false },
}

function install(options: { canManage: boolean }, onWrite?: (method: string, url: string, body: unknown) => void) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    const method = (config.method ?? 'get').toLowerCase()
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, options.canManage ? residentMe : { ...residentMe, resident_memberships: residentMe.resident_memberships.map((m) => ({ ...m, is_primary_contact: false })) }))
    if (url === '/api/portal/resident') return Promise.resolve(axiosResponse(config, { data: { id: 'rs_1', first_name: 'Carlos', last_name: 'Mendoza', name: 'Carlos Mendoza', phone: null, email_alerts: { reservations: true, packages: true, visitors: true, announcements: true }, login_email: 'carlos@x.pe' } }))
    if (method !== 'get') {
      onWrite?.(method, url, config.data ? JSON.parse(config.data as string) : null)
      if (url === '/api/me/password') return Promise.resolve(axiosResponse(config, null, 204))
      if (url === '/api/portal/household') return Promise.resolve(axiosResponse(config, { data: { ...rosa, membership_id: 'um_4', name: 'Tomás Quintana', first_name: 'Tomás', portal_state: 'not_invited' } }, 201))
      if (url.startsWith('/api/portal/household/')) return Promise.resolve(axiosResponse(config, { data: { ...rosa, status: 'inactive' } }))
      if (url.startsWith('/api/portal/vehicles')) return Promise.resolve(axiosResponse(config, { data: yaris }, method === 'post' ? 201 : 200))
    }
    if (url.startsWith('/api/portal/household?')) return Promise.resolve(axiosResponse(config, { data: [carlos, rosa], can_manage: options.canManage }))
    if (url.startsWith('/api/portal/vehicles?')) return Promise.resolve(axiosResponse(config, { data: [yaris], meta: { current_page: 1, last_page: 1, per_page: 50, total: 1 } }))
    if (url.startsWith('/api/portal/ledger?')) return Promise.resolve(axiosResponse(config, url.includes('scope=pending') ? { ...ledger, data: ledger.data.filter((row) => row.state === 'pending') } : ledger))
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  window.localStorage.clear()
})

describe('Mi unidad (P4)', () => {
  it('shows household, vehicles and the balance to the primary contact, and lets them add a person', async () => {
    const user = userEvent.setup()
    const writes: { method: string; url: string; body: unknown }[] = []
    install({ canManage: true }, (method, url, body) => writes.push({ method, url, body }))

    renderPortal(<PortalMyUnitPage />)

    expect(await screen.findByText('Rosa Quintana')).toBeVisible()
    expect(screen.getByText('Tú')).toBeVisible()
    expect(screen.getByText('Invitación pendiente')).toBeVisible()
    expect(screen.getByText('ABC-123')).toBeVisible()
    expect(screen.getByText('Toyota · Yaris · blanco')).toBeVisible()
    expect(await screen.findByText('S/ 320')).toBeVisible()
    expect(screen.getByText(/Última cuota: se[pt]t?iembre · S\/ 250/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ver movimientos' })).toHaveAttribute('href', '/portal/mi-unidad/estado-de-cuenta')

    await user.click(screen.getByRole('button', { name: 'Agregar persona' }))
    const sheet = (await screen.findAllByRole('dialog')).at(-1)!
    await user.type(within(sheet).getByLabelText('Nombre'), 'Tomás')
    await user.type(within(sheet).getByLabelText('Apellido'), 'Quintana')
    await user.click(within(sheet).getByRole('radio', { name: 'Inquilino' }))
    await user.click(within(sheet).getByRole('button', { name: 'Agregar' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ method: 'post', url: '/api/portal/household', body: { unit_id: 'un_402', first_name: 'Tomás', last_name: 'Quintana', phone: null, email: null, resident_type: 'tenant' } })
  })

  it('opens a member, re-sends the invitation and removes them after confirming', async () => {
    const user = userEvent.setup()
    const writes: string[] = []
    install({ canManage: true }, (method, url) => writes.push(`${method} ${url}`))

    renderPortal(<PortalMyUnitPage />)

    await user.click(await screen.findByRole('button', { name: /Rosa Quintana/ }))
    const sheet = (await screen.findAllByRole('dialog')).at(-1)!
    expect(within(sheet).getByText('Familiar · desde marzo de 2025')).toBeVisible()
    expect(within(sheet).getByRole('link', { name: /951 330 470/ })).toHaveAttribute('href', 'tel:+51951330470')

    await user.click(within(sheet).getByRole('button', { name: 'Reenviar invitación' }))
    await waitFor(() => expect(writes).toContain('post /api/portal/household/um_3/resend-invitation'))

    await user.click(within(sheet).getByRole('button', { name: 'Quitar de la unidad' }))
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!
    expect(within(confirm).getByText('¿Quitar a Rosa Quintana de Torre A / 402?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(writes).toContain('delete /api/portal/household/um_3'))
  })

  it('hides the add action and the ledger from a plain member, who can still add a vehicle', async () => {
    const user = userEvent.setup()
    const writes: { url: string; body: unknown }[] = []
    install({ canManage: false }, (_method, url, body) => writes.push({ url, body }))

    renderPortal(<PortalMyUnitPage />)

    expect(await screen.findByText('Solo el contacto principal ve el estado de cuenta.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Agregar persona' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ver movimientos')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Agregar vehículo' }))
    const sheet = (await screen.findAllByRole('dialog')).at(-1)!
    await user.type(within(sheet).getByLabelText('Placa'), 'xyz-789')
    await user.type(within(sheet).getByLabelText('Marca'), 'Hyundai')
    await user.click(within(sheet).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ url: '/api/portal/vehicles', body: { unit_id: 'un_402', vehicle_type: 'car', plate: 'XYZ-789', make: 'Hyundai', model: null, color: null } })
  })

  it('renders the ledger grouped by month with pending and paid rows', async () => {
    const user = userEvent.setup()
    install({ canManage: true })

    renderPortal(<PortalLedgerPage />)

    expect(await screen.findByText('S/ 320')).toBeVisible()
    expect(await screen.findByRole('tab', { name: 'Pendientes · 2' })).toBeVisible()
    expect(screen.getByText('Reserva · Salón de eventos')).toBeVisible()
    expect(screen.queryByText('Depósito devuelto')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Todos' }))
    expect(await screen.findByText('Depósito devuelto')).toBeVisible()
    expect(screen.getByText('− S/ 100')).toBeVisible()
    expect(screen.getByText('Agosto')).toBeVisible()
    expect(screen.getByText('Los pagos se registran en administración.')).toBeVisible()
  })

  it('changes the password once the three fields agree', async () => {
    const user = userEvent.setup()
    const writes: { url: string; body: unknown }[] = []
    install({ canManage: true }, (_method, url, body) => writes.push({ url, body }))

    renderPortal(<PortalProfilePage />)

    const submit = await screen.findByRole('button', { name: 'Cambiar contraseña' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Contraseña actual'), 'secret-123')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'new-secret-9')
    await user.type(screen.getByLabelText('Repetir contraseña'), 'new-secret-9')
    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() => expect(writes).toEqual([{ url: '/api/me/password', body: { current_password: 'secret-123', password: 'new-secret-9', password_confirmation: 'new-secret-9' } }]))
  })
})
