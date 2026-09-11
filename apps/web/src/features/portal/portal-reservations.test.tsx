import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'

const navigateSpy = vi.fn()
const currentSearch: Record<string, unknown> = { chip: 'mine' }
const currentParams: Record<string, string> = { amenityId: 'am_1' }

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useNavigate: () => navigateSpy,
    getRouteApi: () => ({ useNavigate: () => navigateSpy, useSearch: () => currentSearch, useParams: () => currentParams }),
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

const { axiosResponse, renderPortal, residentMe } = await import('./portal-test-utils')
const { PortalReservationsPage } = await import('./portal-reservations-page')
const { PortalBookingPage } = await import('./portal-booking-page')

const originalAdapter = apiClient.defaults.adapter

const amenity = { id: 'am_1', name: 'Salón de eventos', description: 'Ambiente cerrado con cocina y sonido.', booking_mode: 'approval', slot_minutes: 120, fee_amount: 150, deposit_amount: 300, photos: [], cover_photo_url: null }
const reservation = { id: 'rv_1', amenity_id: 'am_1', amenity_name: 'Salón de eventos', unit_id: 'un_402', unit_number: '402', resident_name: 'Carlos Mendoza', starts_at: '2026-09-07T00:00:00Z', ends_at: '2026-09-07T02:00:00Z', status: 'pending', is_completed: false, status_note: null, fee_snapshot: 150, deposit_snapshot: 300, created_by_name: 'Carlos Mendoza', decided_by_name: null, decided_at: null, created_at: '2026-09-04T13:40:00Z' }

function install(onWrite?: (url: string, body: unknown) => void) {
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    if (url === '/api/me') return Promise.resolve(axiosResponse(config, residentMe))
    if (config.method === 'post') {
      onWrite?.(url, config.data ? JSON.parse(config.data as string) : null)
      return Promise.resolve(axiosResponse(config, { data: { ...reservation, status: url.endsWith('/cancel') ? 'cancelled' : 'pending' } }, url.endsWith('/cancel') ? 200 : 201))
    }
    if (url.includes('/portal/reservations?')) {
      const rows = url.includes('scope=past') ? [] : [reservation]
      return Promise.resolve(axiosResponse(config, { data: rows, meta: { current_page: 1, last_page: 1, per_page: 15, total: rows.length } }))
    }
    if (url.startsWith('/api/portal/reservations/rv_1')) return Promise.resolve(axiosResponse(config, { data: reservation, history: [{ id: 'al_1', event_type: 'reservation.created', status: 'pending', note: null, actor_name: 'Carlos Mendoza', created_at: '2026-09-04T13:40:00Z' }], can_cancel: true }))
    if (url.includes('/portal/amenities?')) return Promise.resolve(axiosResponse(config, { data: [amenity] }))
    if (url.includes('/availability?')) {
      return Promise.resolve(axiosResponse(config, { date: url.match(/date=([\d-]+)/)?.[1], slot_minutes: 120, booking_mode: 'approval', fee_amount: 150, deposit_amount: 300, slots: [{ start: '09:00', end: '11:00', available: true, reason: null }, { start: '12:00', end: '14:00', available: false, reason: 'past' }, { start: '19:00', end: '21:00', available: true, reason: null }] }))
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`))
  })
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  navigateSpy.mockReset()
  currentSearch.chip = 'mine'
  window.localStorage.clear()
})

describe('portal reservations', () => {
  it('lists my bookings, opens the detail sheet with the cancel hint, and cancels', async () => {
    const writes: string[] = []
    install((url) => writes.push(url))
    renderPortal(<PortalReservationsPage />)
    const user = userEvent.setup()

    expect(await screen.findByRole('tab', { name: 'Mis reservas · 1' })).toBeInTheDocument()
    await user.click(await screen.findByText('Salón de eventos'))
    const sheet = await screen.findByRole('dialog')
    expect(await within(sheet).findByText('Puedes cancelar hasta la hora de inicio.')).toBeInTheDocument()
    expect(within(sheet).getByText('S/ 150')).toBeInTheDocument()
    expect(within(sheet).getByText('Solicitada')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Cancelar reserva' }))
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!
    expect(within(confirm).getByText('¿Cancelar la reserva de Salón de eventos?')).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar reserva' }))
    await waitFor(() => expect(writes).toEqual(['/api/portal/reservations/rv_1/cancel']))
  })

  it('shows the amenity catalogue with terms and mode', async () => {
    currentSearch.chip = 'amenidades'
    install()
    renderPortal(<PortalReservationsPage />)

    expect(await screen.findByText('Salón de eventos')).toBeInTheDocument()
    expect(screen.getByText('Requiere aprobación')).toBeInTheDocument()
    expect(screen.getByText('S/ 150 · depósito S/ 300')).toBeInTheDocument()
  })

  it('books a free slot for the selected day and sends the request', async () => {
    const writes: { url: string; body: unknown }[] = []
    install((url, body) => writes.push({ url, body }))
    renderPortal(<PortalBookingPage />)
    const user = userEvent.setup()

    expect(await screen.findByRole('option', { name: /12:00–14:00/ })).toBeDisabled()
    await user.click(screen.getByRole('option', { name: '19:00–21:00' }))
    expect(screen.getByText('S/ 150 + depósito S/ 300')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Solicitar reserva' }))

    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].url).toBe('/api/portal/reservations')
    expect(writes[0].body).toMatchObject({ unit_id: 'un_402', amenity_id: 'am_1', start: '19:00', end: '21:00' })
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/portal/reservas', search: { chip: 'mine' } })
  })
})
