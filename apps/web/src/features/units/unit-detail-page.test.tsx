import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { ADMIN_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { UnitDetailResponse } from './api'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useParams: () => ({ unitId: 'un_402' }), useNavigate: () => vi.fn(), useSearch: () => ({}) }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

const { UnitDetailPage } = await import('./unit-detail-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse() {
  return {
    user: { id: 'usr_1', first_name: 'Alejandra', last_name: 'Admin', name: 'Alejandra Admin', email: 'admin@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', capabilities: ADMIN_CAPABILITIES },
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function detail(): UnitDetailResponse {
  return {
    data: {
      id: 'un_402', account_id: 'acc_1', location_id: 'loc_1', unit_number: '402', type: 'apartment', building_name: 'Torre A', floor: '4',
      area_m2: 118, participation_share: 1.18, maintenance_fee: 420, parking_spots: ['E-23'], storage_rooms: ['D-04'], status: 'active', notes: null,
      resident_count: 3, vehicle_count: 2, occupancy: 'occupied', portal_state: 'active', primary_contact: null,
      members: [
        { membership_id: 'um_1', resident_id: 'rs_1', name: 'Carlos Mendoza', email: 'carlos@x.pe', phone: '+51 987 654 321', is_primary_contact: true, started_at: null, portal_state: 'active' },
        { membership_id: 'um_2', resident_id: 'rs_2', name: 'Laura Mendoza', email: 'laura@x.pe', phone: null, is_primary_contact: false, started_at: null, portal_state: 'active' },
        { membership_id: 'um_3', resident_id: 'rs_3', name: 'Tomás Mendoza', email: null, phone: null, is_primary_contact: false, started_at: null, portal_state: 'not_invited' },
      ],
      vehicles: [
        { id: 'vh_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_402', vehicle_type: 'car', plate: 'AXB-241', make: 'Toyota', model: 'RAV4', color: 'gris', status: 'active', notes: null },
        { id: 'vh_2', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_402', vehicle_type: 'car', plate: 'BQT-702', make: 'Nissan', model: 'Versa', color: 'blanco', status: 'inactive', notes: null },
      ],
    },
    packages: [],
    visits: [],
    reservations: [],
    movements: [
      { id: 'mv_1', account_id: 'acc_1', location_id: 'loc_1', direction: 'income', category: 'maintenance_dues', status: 'paid', allowed_transitions: ['pending'], amount: 420, concept: 'Cuota de mantenimiento · agosto 2026', detail: 'Emitida el 01 ago · Torre A / 402', counterparty: null, unit_id: 'un_402', reservation_id: null, occurred_on: '2026-08-01', due_on: null, note: null, created_by: 'usr_1', settled_by: 'usr_1', settled_at: null, created_at: null },
      { id: 'mv_2', account_id: 'acc_1', location_id: 'loc_1', direction: 'income', category: 'fine', status: 'pending', allowed_transitions: ['paid', 'voided'], amount: 80, concept: 'Multa · ruido fuera de horario', detail: null, counterparty: null, unit_id: 'un_402', reservation_id: null, occurred_on: '2026-08-11', due_on: null, note: null, created_by: 'usr_1', settled_by: null, settled_at: null, created_at: null },
    ],
    movements_month: '2026-08',
    pending_balance: 80,
    notes: [{ id: 'al_1', body: 'Autorizan a la Sra. Elena Vargas como visita recurrente.', author_name: 'María Torres', created_at: '2026-06-02T15:00:00Z' }],
  }
}

function installAdapter(onNote?: (body: unknown) => void, onWrite?: (method: string, url: string, body: unknown) => void) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    if (config.method && config.method !== 'get' && !url.endsWith('/notes')) {
      onWrite?.(config.method, url, config.data ? JSON.parse(config.data as string) : null)
      if (url.includes('/residents?')) return Promise.resolve(axiosResponse(config, { data: [] }))
      return Promise.resolve(axiosResponse(config, { data: { id: 'new', email: null } }, 201))
    }
    if (url.includes('/residents?')) {
      return Promise.resolve(axiosResponse(config, { data: [{ id: 'rs_9', name: 'Laura Mendoza', email: 'laura.mz@gmail.com', memberships: [] }], meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 } }))
    }
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse()))
    if (config.method === 'post' && url.endsWith('/notes')) {
      onNote?.(JSON.parse(config.data as string))
      return Promise.resolve(axiosResponse(config, { data: { id: 'al_2', body: 'x', author_name: 'Alejandra Admin', created_at: null } }, 201))
    }
    if (url === '/api/units/un_402') return Promise.resolve(axiosResponse(config, detail()))
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <UnitDetailPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
})

describe('UnitDetailPage', () => {
  it('renders the header facts and every section from the show endpoint', async () => {
    installAdapter()
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Depto. 402' })).toBeInTheDocument()
    expect(screen.getByText('Torre A · Piso 4 · Departamento · 118 m²')).toBeInTheDocument()
    expect(screen.getByText('1.18 %')).toBeInTheDocument()
    expect(screen.getByText('E-23')).toBeInTheDocument()
    expect(screen.getByText('D-04')).toBeInTheDocument()

    expect(screen.getByText('Residentes · 3')).toBeInTheDocument()
    // Once in Residentes, once in Portal del residente.
    expect(screen.getAllByText('Carlos Mendoza')).toHaveLength(2)
    expect(screen.getByText('Contacto principal')).toBeInTheDocument()

    expect(screen.getByText('Cuotas y cobros · agosto 2026')).toBeInTheDocument()
    expect(screen.getByText('Multa · ruido fuera de horario')).toBeInTheDocument()
    expect(screen.getByText('Saldo pendiente: S/ 80')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver en Finanzas →' })).toHaveAttribute('href', '/admin/finances')

    expect(screen.getByText('Vehículos · 2')).toBeInTheDocument()
    expect(screen.getByText('AXB-241')).toBeInTheDocument()
    expect(screen.getByText('Toyota RAV4 · gris')).toBeInTheDocument()
    expect(screen.getByText('Sin reservas próximas.')).toBeInTheDocument()
    expect(screen.getByText(/Autorizan a la Sra. Elena Vargas/)).toBeInTheDocument()
    expect(screen.getByText(/María Torres/)).toBeInTheDocument()
  })

  it('adds an internal note', async () => {
    const posted: unknown[] = []
    installAdapter((body) => posted.push(body))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Agregar nota' }))
    const notes = screen.getByRole('heading', { name: 'Notas internas' }).closest('section')!
    await user.type(within(notes).getByRole('textbox'), 'Llave de repuesto en recepción.')
    await user.click(within(notes).getByRole('button', { name: 'Guardar nota' }))

    await waitFor(() => expect(posted).toEqual([{ body: 'Llave de repuesto en recepción.' }]))
    expect(await screen.findByText('Nota agregada')).toBeInTheDocument()
  })

  it('edits the unit from the header drawer and sends the condo fields', async () => {
    const writes: { method: string; url: string; body: unknown }[] = []
    installAdapter(undefined, (method, url, body) => writes.push({ method, url, body }))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Editar unidad' }))
    const drawer = await screen.findByRole('dialog')
    const fee = within(drawer).getByLabelText('Cuota mensual')
    await user.clear(fee)
    await user.type(fee, '450')
    await user.click(within(drawer).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].method).toBe('patch')
    expect(writes[0].url).toBe('/api/units/un_402')
    expect(writes[0].body).toMatchObject({ unit_number: '402', type: 'apartment', building_name: 'Torre A', area_m2: 118, participation_share: 1.18, maintenance_fee: 450, parking_spots: 'E-23', storage_rooms: 'D-04' })
  })

  it('adds a new person to the unit with role, primary contact and invitation', async () => {
    const writes: { method: string; url: string; body: unknown }[] = []
    installAdapter(undefined, (method, url, body) => writes.push({ method, url, body }))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Agregar residente' }))
    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByRole('radio', { name: 'Nueva persona' }))
    await user.type(within(drawer).getByLabelText('Nombres'), 'Elena')
    await user.type(within(drawer).getByLabelText('Apellidos'), 'Vargas')
    await user.type(within(drawer).getByLabelText('Correo del residente'), 'elena@x.pe')
    await user.click(within(drawer).getByRole('button', { name: 'Agregar' }))

    await waitFor(() => expect(writes.length).toBeGreaterThanOrEqual(2))
    expect(writes[0].url).toBe('/api/accounts/acc_1/residents')
    expect(writes[0].body).toMatchObject({ first_name: 'Elena', last_name: 'Vargas', email: null, memberships: [{ unit_id: 'un_402', is_primary_contact: false }] })
    expect(writes[1].url).toBe('/api/residents/new/invitations')
    expect(writes[1].body).toEqual({ email: 'elena@x.pe' })
  })

  it('opens the deactivation confirmation from the sensitive zone and cascades', async () => {
    const writes: { method: string; url: string; body: unknown }[] = []
    installAdapter(undefined, (method, url, body) => writes.push({ method, url, body }))
    renderPage()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Editar unidad' }))
    await user.click(await screen.findByRole('button', { name: 'Desactivar unidad' }))
    expect(await screen.findByText('¿Desactivar la unidad 402?')).toBeInTheDocument()
    expect(screen.getByText(/3 residente\(s\) perderán el acceso al portal y 1 vehículo/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(writes.some((write) => write.url === '/api/units/un_402/deactivate')).toBe(true))
  })
})
