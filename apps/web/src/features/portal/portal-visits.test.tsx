import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { PortalVisit } from './api'

const navigateSpy = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useRouterState: () => '/portal/visitas',
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

const { axiosResponse, renderPortal, residentMe } = await import('./portal-test-utils')
const { PortalVisitsPage } = await import('./portal-visits-page')
const { PortalHomePage } = await import('./portal-home-page')
const { PortalVisitFormPage } = await import('./portal-visit-form-page')

const originalAdapter = apiClient.defaults.adapter

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function visit(overrides: Partial<PortalVisit> = {}): PortalVisit {
  return {
    id: 'vs_1', unit_id: 'un_402', unit_number: '402', building_name: 'Torre A', visitor_name: 'Jorge Peña', document: '41290877', notes: 'Viene a recoger unas llaves.',
    status: 'expected', expected_on: todayIso(), expected_time: '19:00', pre_registered_by_name: 'Carlos Mendoza', pre_registered_at: '2026-09-04T13:12:00Z',
    checked_in_at: null, checked_in_by_name: null, checked_out_at: null, auto_checked_out: false, cancelled_at: null, ...overrides,
  }
}

function install(expected: PortalVisit[], history: PortalVisit[] = [], onWrite?: (url: string, body: unknown) => void) {
  const urls: string[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    urls.push(url)
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, residentMe))
    if (config.method === 'post') {
      onWrite?.(url, config.data ? JSON.parse(config.data as string) : null)
      return Promise.resolve(axiosResponse(config, { data: visit({ status: url.endsWith('/cancel') ? 'cancelled' : 'expected' }) }, url.endsWith('/cancel') ? 200 : 201))
    }
    if (url.includes('/portal/visits?')) {
      const rows = url.includes('scope=history') ? history : expected
      return Promise.resolve(axiosResponse(config, { data: rows, meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length } }))
    }
    if (url.includes('/portal/packages?')) {
      return Promise.resolve(axiosResponse(config, { data: [{ id: 'pk_1', unit_id: 'un_402', resident_name: 'Carlos Mendoza', notes: 'Olva Courier · caja mediana', status: 'pending', received_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), delivered_at: null }], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } }))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  return urls
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  window.localStorage.clear()
})

describe('portal visits', () => {
  it('home shows today\'s expected visitors and packages for the active unit', async () => {
    const urls = install([visit(), visit({ id: 'vs_2', visitor_name: 'Delivery Rappi', status: 'inside', expected_time: null, checked_in_at: new Date().toISOString() })])
    renderPortal(<PortalHomePage />)

    expect(await screen.findByText('Hola, Carlos')).toBeInTheDocument()
    expect(await screen.findByText('Jorge Peña')).toBeInTheDocument()
    expect(screen.getByText('Hoy · 19:00')).toBeInTheDocument()
    expect(screen.getByText('Esperado')).toBeInTheDocument()
    expect(screen.getByText(/^Llegó \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(await screen.findByText('Olva Courier · caja mediana')).toBeInTheDocument()
    expect(screen.getByText('hace 2 días')).toBeInTheDocument()
    // Scoped to the primary contact's unit by default.
    expect(urls.some((url) => url.includes('unit_id=un_402') && url.includes('scope=today'))).toBe(true)
  })

  it('lists expected and history, opens the detail sheet, and cancels a pre-registration', async () => {
    const writes: string[] = []
    install([visit()], [visit({ id: 'vs_9', visitor_name: 'Marcela Ríos', status: 'left', checked_in_at: '2026-09-02T23:05:00Z', checked_out_at: '2026-09-03T01:30:00Z' })], (url) => writes.push(url))
    renderPortal(<PortalVisitsPage />)
    const user = userEvent.setup()

    expect(await screen.findByText('Jorge Peña')).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'Esperados · 1' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(await screen.findByText('Marcela Ríos')).toBeInTheDocument()
    expect(screen.getByText(/^[a-záé]{3} 2 · 18:05 → 20:30$/)).toBeInTheDocument()
    expect(screen.getByText(/^Se[pt]iembre$/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Esperados · 1' }))
    await user.click(await screen.findByText('Jorge Peña'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Viene a recoger unas llaves.')).toBeInTheDocument()
    expect(within(sheet).getByText('Pre-registrado')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Cancelar pre-registro' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(writes).toEqual(['/api/portal/visits/vs_1/cancel']))
  })

  it('pre-registers with today as the default date and only the fields typed', async () => {
    const writes: { url: string; body: unknown }[] = []
    install([], [], (url, body) => writes.push({ url, body }))
    renderPortal(<PortalVisitFormPage />)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText('Nombre del visitante'), 'Jorge Peña')
    await user.type(screen.getByLabelText('Hora aproximada (opcional)'), '19:00')
    await user.type(screen.getByLabelText('Nota para recepción (opcional)'), 'Viene a recoger unas llaves')
    await user.click(screen.getByRole('button', { name: 'Pre-registrar visita' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body).toEqual({ unit_id: 'un_402', visitor_name: 'Jorge Peña', document: null, expected_on: todayIso(), expected_time: '19:00', notes: 'Viene a recoger unas llaves' })
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/portal/visitas' })
  })
})
