import { MantineProvider } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { queryClient } from '../../app/query-client'
import { notifyError } from '../../lib/notify'
import { ApprovalQueue } from './approval-queue'
import type { ReservationSummary } from './api'

vi.mock('../../lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('./api', () => ({ approveReservation: vi.fn().mockRejectedValue(new Error('Unavailable day')) }))
afterEach(() => { cleanup(); queryClient.clear(); vi.clearAllMocks() })

it('reports a failed approval only once through the app mutation handler', async () => {
  const request = { id: 'r1', amenity_id: 'a1', amenity_name: 'Parrilla', unit_number: '1202', status: 'pending', reserved_on: '2026-09-07' } as ReservationSummary
  render(<MantineProvider env="test"><QueryClientProvider client={queryClient}>
    <ApprovalQueue accountId="account" canDecide requests={[request]} timezone="America/Lima" />
  </QueryClientProvider></MantineProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }))
  await waitFor(() => expect(notifyError).toHaveBeenCalledTimes(1))
  expect(notifyError).toHaveBeenCalledWith('Unavailable day', 'No se pudo completar la acción')
})

it.each([
  ['2026-09-07T06:00:00Z', 'Recibida hoy'],
  ['2026-09-07T04:30:00Z', 'En espera desde hace 1 día'],
  ['2026-09-05T06:00:00Z', 'En espera desde hace 2 días'],
])('labels waiting time by the location calendar for %s', (createdAt, expected) => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-07T07:00:00Z'))
  const request = { id: 'r1', amenity_id: 'a1', amenity_name: 'Parrilla', unit_number: '1202', status: 'pending', reserved_on: '2026-09-11', created_at: createdAt } as ReservationSummary
  try {
    render(<MantineProvider env="test"><QueryClientProvider client={queryClient}>
      <ApprovalQueue accountId="account" canDecide requests={[request]} timezone="America/Lima" />
    </QueryClientProvider></MantineProvider>)
    expect(screen.getByText(expected)).toBeInTheDocument()
  } finally {
    now.mockRestore()
  }
})
