import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { LocationDashboardResponse } from './api'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useNavigate: () => vi.fn(), useSearch: () => ({}) }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

const { DashboardPage } = await import('./dashboard-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse(role: 'location_manager' | 'front_desk') {
  return {
    user: { id: 'usr_1', first_name: 'Ana', last_name: 'Quispe', name: 'Ana Quispe', email: 'ana@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', roles: [role], access_source: 'location_role' },
    roles: { account: [], location: [{ account_id: 'acc_1', location_id: 'loc_1', role }] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60_000).toISOString()
const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString()

function dashboard(withManagement: boolean): LocationDashboardResponse {
  return {
    location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima' },
    today: {
      date: '2026-09-04',
      visitors_inside_count: 2,
      visitors_overdue_count: 1,
      visitors_inside: [
        { id: 'vs_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_1', unit_number: '1203', building_name: 'Torre 1', resident_id: null, resident_name: null, resident_phone: null, visitor_name: 'Jorge Peña', document: null, phone: null, confirmation: 'none', notes: null, status: 'inside', checked_in_at: sixHoursAgo, checked_in_by_name: 'A. Quispe', checked_out_at: null, checked_out_by_name: null, checkout_notes: null, auto_checked_out: false, is_overdue: true },
        { id: 'vs_2', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_2', unit_number: '402', building_name: 'Torre 1', resident_id: null, resident_name: null, resident_phone: null, visitor_name: 'Elena Vargas', document: null, phone: null, confirmation: 'intercom', notes: null, status: 'inside', checked_in_at: hourAgo, checked_in_by_name: 'A. Quispe', checked_out_at: null, checked_out_by_name: null, checkout_notes: null, auto_checked_out: false, is_overdue: false },
      ],
      exits_today_count: 14,
      packages_pending_count: 1,
      packages_oldest_received_at: fiveDaysAgo,
      packages_pending: [
        { id: 'pk_1', account_id: 'acc_1', location_id: 'loc_1', unit_id: 'un_3', unit_number: '402', building_name: 'Torre 2', resident_id: 'rs_1', resident_name: 'Carlos Mendoza', notes: 'Olva Courier', status: 'pending', received_at: fiveDaysAgo, received_by_name: 'A. Quispe', delivered_at: null, delivered_by_name: null, delivery_notes: null, notified_email: null },
      ],
      reservations_today_count: 1,
      reservations_with_deposit_count: 1,
      reservations_today: [
        { id: 'rv_1', account_id: 'acc_1', location_id: 'loc_1', amenity_id: 'am_1', amenity_name: 'Salón de eventos', unit_id: 'un_2', unit_number: '402', resident_id: 'rs_2', resident_name: 'Lucía Ramírez', resident_phone: null, resident_email: null, starts_at: '2026-09-04T14:00:00Z', ends_at: '2026-09-04T16:00:00Z', status: 'approved', is_completed: false, status_note: null, fee_snapshot: 200, deposit_snapshot: 300, created_by: 'usr_1', created_by_name: null, decided_by: null, decided_by_name: null, decided_at: null, created_at: null } as LocationDashboardResponse['today']['reservations_today'][number],
      ],
      pending_movements_count: 3,
    },
    ...(withManagement
      ? {
          management: {
            month: '2026-09',
            dues_issued_total: 24600,
            dues_collected_total: 18450,
            units_with_balance_count: 14,
            deposits_held_total: 1200,
            deposits_held_count: 3,
            residents_not_invited_count: 9,
            units_total: 96,
            units_occupied: 82,
            units_vacant: 9,
            units_without_primary_contact: 5,
            activity: [{ id: 'al_1', event_type: 'dues.generated', summary: 'Se generaron 96 cuotas de mantenimiento de septiembre 2026.', actor_name: 'Alejandra Admin', created_at: hourAgo }],
          },
        }
      : {}),
  }
}

function installAdapter(role: 'location_manager' | 'front_desk') {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse(role)))
    if (url === '/api/locations/loc_1/dashboard') return Promise.resolve(axiosResponse(config, dashboard(role === 'location_manager')))
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
})

describe('DashboardPage', () => {
  it('shows managers both strips with manager quick actions and the pending movements tile', async () => {
    installAdapter('location_manager')
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Panel de Edificio Central' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo movimiento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar cuotas del mes' })).toBeInTheDocument()

    expect(await screen.findByText('Movimientos pendientes')).toBeInTheDocument()
    expect(screen.queryByText('Salidas registradas hoy')).not.toBeInTheDocument()
    expect(screen.getByText('1 salida por confirmar')).toBeInTheDocument()
    expect(screen.getByText('el más antiguo, 5 días')).toBeInTheDocument()

    // Visitors: overdue dot on the long stay, unit chip with building initials.
    expect(screen.getByText('Jorge Peña')).toBeInTheDocument()
    expect(screen.getByLabelText('Salida por confirmar')).toBeInTheDocument()
    expect(screen.getByText('T1-1203')).toBeInTheDocument()
    expect(screen.getByText('hace 5 días')).toBeInTheDocument()
    expect(screen.getByText('Salón de eventos')).toBeInTheDocument()

    // Management strip.
    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(screen.getByText('S/ 18 450')).toBeInTheDocument()
    expect(screen.getByText('de S/ 24 600 emitidas · 75 %')).toBeInTheDocument()
    expect(screen.getByText('3 reservas')).toBeInTheDocument()
    expect(screen.getByText('96 en total')).toBeInTheDocument()
    expect(screen.getByText(/Se generaron 96 cuotas/)).toBeInTheDocument()
    expect(screen.getByText('hace 1 h')).toBeInTheDocument()
  })

  it('shows the front desk only the today strip with the exits tile and desk actions', async () => {
    installAdapter('front_desk')
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Panel de Edificio Central' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar visita' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar paquete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo movimiento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar cuotas del mes' })).not.toBeInTheDocument()

    expect(await screen.findByText('Salidas registradas hoy')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.queryByText('Movimientos pendientes')).not.toBeInTheDocument()
    expect(screen.queryByText('Administración')).not.toBeInTheDocument()
    expect(screen.queryByText('Cuotas cobradas')).not.toBeInTheDocument()
  })
})
