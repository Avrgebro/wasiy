import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { AnnouncementSummary } from './api'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { page: 1, search: '', chip: 'active' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    getRouteApi: () => ({ useNavigate: () => navigateSpy, useSearch: () => currentSearch }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  }
})

// ProseMirror does not run under jsdom; the editor becomes a plain textarea bound to the same value.
vi.mock('./announcement-editor', () => ({
  AnnouncementEditor: ({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) => (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  ),
}))

const { AnnouncementsPage } = await import('./announcements-page')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function meResponse() {
  return {
    user: { id: 'usr_1', first_name: 'Ana', last_name: 'Torres', name: 'Ana Torres', email: 'ana@wasiy.test' },
    accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' }],
    active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima' },
    active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', capabilities: ['announcements.manage'] },
    roles: { account: [], location: [{ account_id: 'acc_1', location_id: 'loc_1', role: 'location_manager' }] },
    accessible_locations: [],
    resident_memberships: [],
  }
}

function post(overrides: Partial<AnnouncementSummary> = {}): AnnouncementSummary {
  return {
    id: 'an_1', account_id: 'acc_1', location_id: 'loc_1', title: 'Corte de agua programado',
    body_md: 'El martes cortaremos el agua.\n\n- Almacenen agua', body_html: '<p>El martes cortaremos el agua.</p>\n<ul>\n<li>Almacenen agua</li>\n</ul>',
    excerpt: 'El martes cortaremos el agua.', is_important: true, status: 'active',
    publish_at: '2026-08-31T23:20:00Z', published_at: '2026-08-31T23:20:00Z', expires_on: '2026-09-09', archived_at: null,
    author_name: 'Ana Torres', notified_count: 214, emailed_count: 168, ...overrides,
  }
}

function installAdapter(rows: AnnouncementSummary[], onWrite?: (url: string, method: string, body: unknown) => void) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, meResponse()))
    if (config.method === 'post' || config.method === 'patch') {
      onWrite?.(url, config.method, config.data ? JSON.parse(config.data as string) : null)
      return Promise.resolve(axiosResponse(config, { data: post({ status: url.endsWith('/archive') ? 'archived' : 'active', notified_count: 2 }) }, 201))
    }
    if (url.includes('/announcements')) {
      const status = new URL(url, 'http://x').searchParams.get('status')
      const filtered = status ? rows.filter((row) => row.status === status) : rows
      return Promise.resolve(axiosResponse(config, { data: filtered, meta: { current_page: 1, last_page: 1, per_page: 15, total: filtered.length } }))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <AnnouncementsPage />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-05T17:00:00Z') })
  Object.assign(currentSearch, { page: 1, search: '', chip: 'active' })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
})

describe('AnnouncementsPage', () => {
  it('lists the active posts with counts, opens the detail and archives from it', async () => {
    const writes: { url: string; method: string }[] = []
    installAdapter(
      [post(), post({ id: 'an_2', title: 'Nuevo horario de recepción', is_important: false, expires_on: null, notified_count: 212 }), post({ id: 'an_3', title: 'Fumigación', status: 'scheduled', published_at: null, publish_at: '2026-09-08T13:00:00Z', notified_count: 0 })],
      (url, method) => writes.push({ url, method }),
    )

    renderPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Corte de agua programado')).toBeInTheDocument()
    expect(screen.getByText('Edificio Central · 2 vigentes · 1 programados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vigentes 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Programados 1' })).toBeInTheDocument()
    // The active view leaves the scheduled one out; validity and author read from the row.
    expect(screen.queryByText('Fumigación')).not.toBeInTheDocument()
    expect(screen.getByText('hasta 09 set')).toBeInTheDocument()
    expect(screen.getByText('sin vencimiento')).toBeInTheDocument()
    expect(screen.getAllByText('Importante')).toHaveLength(1)

    await user.click(screen.getByText('Corte de agua programado'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Almacenen agua')).toBeInTheDocument()
    expect(within(drawer).getByText('214 residentes')).toBeInTheDocument()
    expect(within(drawer).getByText('Enviado a 168')).toBeInTheDocument()

    await user.click(within(drawer).getByRole('button', { name: 'Archivar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(writes).toEqual([{ url: '/api/announcements/an_1/archive', method: 'post' }]))
    expect(await screen.findByText('Anuncio archivado')).toBeInTheDocument()
  })

  it('publishes now from the form, and schedules when a date and time are given', async () => {
    const writes: { url: string; body: unknown }[] = []
    installAdapter([], (url, _method, body) => writes.push({ url, body }))

    renderPage()
    const user = userEvent.setup()
    await screen.findByText('No hay anuncios vigentes en Edificio Central.')
    // The header button; the empty state offers a second one.
    await user.click(screen.getAllByRole('button', { name: 'Nuevo anuncio' })[0])
    const drawer = await screen.findByRole('dialog')

    await user.type(within(drawer).getByLabelText(/^Título/), 'Corte de agua programado')
    await user.type(within(drawer).getByLabelText('Contenido'), 'El martes cortaremos el agua.')
    await user.click(within(drawer).getByRole('switch', { name: 'Importante' }))
    await user.click(within(drawer).getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({
      url: '/api/locations/loc_1/announcements',
      body: { title: 'Corte de agua programado', body_md: 'El martes cortaremos el agua.', is_important: true, expires_on: null, publish_at: null },
    })
    expect(await screen.findByText('Anuncio publicado · 2 residentes notificados')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Nuevo anuncio' })[0])
    const second = await screen.findByRole('dialog')
    await user.type(within(second).getByLabelText(/^Título/), 'Fumigación')
    await user.type(within(second).getByLabelText('Contenido'), 'Lunes por la mañana.')
    await user.click(within(second).getByRole('radio', { name: 'Programar' }))
    await user.type(within(second).getByLabelText('Fecha'), '2026-09-08')
    await user.clear(within(second).getByLabelText('Hora'))
    await user.type(within(second).getByLabelText('Hora'), '08:00')
    await user.type(within(second).getByLabelText('Vigente hasta'), '2026-09-12')
    await user.click(within(second).getByRole('button', { name: 'Programar' }))

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1].body).toEqual({ title: 'Fumigación', body_md: 'Lunes por la mañana.', is_important: false, expires_on: '2026-09-12', publish_at: '2026-09-08 08:00' })
  })
})
