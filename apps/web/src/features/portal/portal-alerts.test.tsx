import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { PortalAlert } from './api'

const navigateSpy = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useRouterState: () => '/portal/alertas',
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

const { axiosResponse, renderPortal, residentMe } = await import('./portal-test-utils')
const { PortalAlertsPage } = await import('./portal-alerts-page')
const { PortalProfilePage } = await import('./portal-profile-page')
const { PortalLayout } = await import('../../components/layout/portal/portal-layout')

const originalAdapter = apiClient.defaults.adapter

function alert(overrides: Partial<PortalAlert> = {}): PortalAlert {
  return {
    id: 'al_1', unit_id: 'un_402', kind: 'reservation.approved', family: 'reservations', title: 'Tu reserva fue aprobada', body: 'Salón de eventos · sáb 6 · 19:00–21:00',
    subject_type: 'reservation', subject_id: 'rv_1', read_at: null, created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), ...overrides,
  }
}

function install(alerts: PortalAlert[], onWrite?: (url: string, body: unknown) => void) {
  let rows = alerts
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, residentMe))
    if (url === '/api/portal/resident') return Promise.resolve(axiosResponse(config, { data: { id: 'rs_1', first_name: 'Carlos', last_name: 'Mendoza', name: 'Carlos Mendoza', phone: null, email_alerts: { reservations: true, packages: false, visitors: true, announcements: true }, login_email: 'carlos@x.pe' } }))
    if (config.method === 'patch') {
      const body = JSON.parse(config.data as string)
      onWrite?.(url, body)
      return Promise.resolve(axiosResponse(config, { data: { id: 'rs_1', email_alerts: body, login_email: 'carlos@x.pe' } }))
    }
    if (config.method === 'post') {
      onWrite?.(url, config.data ? JSON.parse(config.data as string) : null)
      if (url.endsWith('/read-all')) {
        rows = rows.map((row) => ({ ...row, read_at: new Date().toISOString() }))
        return Promise.resolve(axiosResponse(config, { marked: 1 }))
      }
      const id = url.split('/')[4]
      rows = rows.map((row) => (row.id === id ? { ...row, read_at: new Date().toISOString() } : row))
      return Promise.resolve(axiosResponse(config, { data: rows.find((row) => row.id === id) }))
    }
    if (url.includes('/portal/alerts/unread-count')) return Promise.resolve(axiosResponse(config, { unread: rows.filter((row) => row.read_at === null).length }))
    if (url.includes('/portal/alerts?')) {
      const shown = url.includes('scope=new') ? rows.filter((row) => row.read_at === null) : rows
      return Promise.resolve(axiosResponse(config, { data: shown, meta: { current_page: 1, last_page: 1, per_page: 50, total: shown.length } }))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

// The age labels depend on the calendar day: an alert from two hours ago is
// "ayer" between midnight and 2am, so the clock is pinned to midday.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-05T17:00:00Z') })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  window.localStorage.clear()
})

describe('portal alerts (P3)', () => {
  it('shows the bell with the unread count for the active unit', async () => {
    install([alert(), alert({ id: 'al_2', kind: 'package.received', family: 'packages', title: 'Paquete recibido', subject_type: 'package', subject_id: 'pk_1' }), alert({ id: 'al_3', read_at: '2026-09-04T10:00:00Z' })])

    renderPortal(<PortalLayout navItems={[]}>child</PortalLayout>)

    const bell = await screen.findByRole('link', { name: 'Alertas · 2 sin leer' })
    expect(bell).toHaveAttribute('href', '/portal/alertas')
    expect(within(bell).getByText('2')).toBeVisible()
  })

  it('lists new alerts, opens one (marks it read and navigates to the booking) and marks all read', async () => {
    const user = userEvent.setup()
    const writes: string[] = []
    install([alert(), alert({ id: 'al_2', kind: 'visit.arrived', family: 'visitors', title: 'Visitante llegó', body: 'Jorge Peña ingresó a tu unidad.', subject_type: 'visit', subject_id: 'vs_1', created_at: new Date(Date.now() - 30 * 3_600_000).toISOString() })], (url) => writes.push(url))

    renderPortal(<PortalAlertsPage />)

    expect(await screen.findByRole('tab', { name: 'Nuevas · 2' })).toBeVisible()
    expect(screen.getByText('hace 2 h')).toBeVisible()
    expect(screen.getByText('ayer')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Tu reserva fue aprobada · sin leer' }))
    await waitFor(() => expect(writes).toContain('/api/portal/alerts/al_1/read'))
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/portal/reservas', search: { chip: 'mine', reserva: 'rv_1' } })
    expect(await screen.findByRole('tab', { name: 'Nuevas · 1' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Marcar todo como leído' }))
    await waitFor(() => expect(writes).toContain('/api/portal/alerts/read-all'))
    expect(await screen.findByText('Estás al día.')).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Todas' }))
    expect(await screen.findByRole('button', { name: 'Visitante llegó' })).toBeVisible()
  })

  it('shows the email switches in Perfil and saves a change', async () => {
    const user = userEvent.setup()
    const writes: { url: string; body: unknown }[] = []
    install([], (url, body) => writes.push({ url, body }))

    renderPortal(<PortalProfilePage />)

    expect(await screen.findByText('Notificaciones por correo')).toBeVisible()
    // Mantine folds the description into the label, so names are matched by prefix.
    const packages = await screen.findByRole('switch', { name: /^Paquetes/ })
    expect(packages).not.toBeChecked()
    expect(screen.getByRole('switch', { name: /^Reservas/ })).toBeChecked()
    expect(screen.getByText('carlos@x.pe · el correo de acceso se podrá cambiar pronto desde Perfil')).toBeVisible()

    await user.click(packages)
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ url: '/api/portal/resident/email-alerts', body: { reservations: true, packages: true, visitors: true, announcements: true } })
    expect(screen.getByRole('switch', { name: /^Paquetes/ })).toBeChecked()
  })
})
