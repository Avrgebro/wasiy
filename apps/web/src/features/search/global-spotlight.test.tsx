import { MantineProvider } from '@mantine/core'
import { spotlight } from '@mantine/spotlight'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import { FRONT_DESK_CAPABILITIES } from '../auth/access'
import '../../i18n'
import type { SearchResponse } from './api'

const navigateSpy = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return { ...actual, useNavigate: () => navigateSpy }
})

const { GlobalSpotlight } = await import('./global-spotlight')
const { getAdminNavigation } = await import('../navigation/admin-navigation')

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

const me = {
  user: { id: 'usr_1', first_name: 'Ana', last_name: 'Quispe', name: 'Ana Quispe', email: 'ana@wasiy.test' },
  accounts: [{ id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, active_locations_count: 1, subscription: null, access: { account_role: null, locations: [] } }],
  active_account: { id: 'acc_1', name: 'Horizonte', slug: 'horizonte', timezone: 'America/Lima', locations_count: 1, active_locations_count: 1, subscription: null, access: { account_role: null, locations: [] } },
  active_location: { id: 'loc_1', account_id: 'acc_1', name: 'Edificio Central', slug: 'edificio-central', timezone: 'America/Lima', address: null, roles: ['front_desk'], capabilities: FRONT_DESK_CAPABILITIES, country: 'PE', access_source: 'location_role' },
  roles: { account: [], location: [{ account_id: 'acc_1', location_id: 'loc_1', role: 'front_desk' }] },
  accessible_locations: [],
  resident_memberships: [],
} as const

const results: SearchResponse = {
  q: 'nuñez',
  groups: [
    { key: 'residents', items: [{ id: 'rs_1', label: 'Patricia Núñez', description: 'Torre A / 402', to: { page: 'resident', resident_id: 'rs_1' } }] },
    { key: 'visits', items: [{ id: 'vs_1', label: 'Jorge Nunez', description: 'Torre A / 402 · dentro', to: { page: 'visit', visit_id: 'vs_1' } }] },
  ],
}

function install() {
  const urls: string[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    urls.push(url)
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, me))
    if (url.startsWith('/api/locations/loc_1/search?q=')) return Promise.resolve(axiosResponse(config, results))
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
  return urls
}

function renderSpotlight() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <QueryClientProvider client={queryClient}>
        <GlobalSpotlight navItems={getAdminNavigation(me as never)} />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

function groupLabels() {
  return Array.from(document.querySelectorAll<HTMLElement>('[style*="--spotlight-label"]')).map((el) => el.style.getPropertyValue('--spotlight-label').replace(/^'|'$/g, ''))
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
})

describe('GlobalSpotlight', () => {
  it('matches pages locally, fetches grouped hits after two characters, and navigates on pick', async () => {
    const urls = install()
    renderSpotlight()
    const user = userEvent.setup()

    act(() => spotlight.open())
    const input = await screen.findByPlaceholderText('Buscar unidades, residentes, visitantes, paquetes o páginas…')
    expect(screen.getByText('Escribe al menos dos letras.')).toBeInTheDocument()

    await user.type(input, 'vis')
    // "Visitantes" is a page the desk can open; matched without any request.
    // Spotlight paints group labels with CSS from --spotlight-label.
    expect(await screen.findByText('Visitantes')).toBeInTheDocument()
    expect(groupLabels()).toEqual(['Páginas'])

    await user.clear(input)
    await user.type(input, 'nuñez')
    expect(await screen.findByText('Patricia Núñez')).toBeInTheDocument()
    expect(groupLabels()).toEqual(['Residentes', 'Visitantes'])
    expect(screen.getByText('Torre A / 402 · dentro')).toBeInTheDocument()
    await waitFor(() => expect(urls.some((url) => url.includes('search?q=nu%C3%B1ez'))).toBe(true))

    await user.click(screen.getByText('Patricia Núñez'))
    expect(navigateSpy).toHaveBeenCalledWith(expect.objectContaining({ to: '/admin/residents', search: expect.objectContaining({ search: 'Patricia Núñez' }) }))
  })
})
