import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import '../../i18n'
import { ReservationStatusBadge } from './reservation-status-badge'

afterEach(cleanup)
it('explains the status on hover, focus and tap without activating its row', async () => {
  const select = vi.fn()
  const user = userEvent.setup()
  render(<MantineProvider env="test"><div onClick={select} onKeyDown={select}>
    <ReservationStatusBadge reservation={{ status: 'pending', is_completed: false }} />
  </div></MantineProvider>)
  const badge = screen.getByRole('button', { name: 'Pendiente' })
  await user.hover(badge)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Espera aprobación.')
  await user.unhover(badge)
  await user.tab()
  expect(badge).toHaveFocus()
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  await user.click(badge)
  expect(screen.getByRole('tooltip')).toBeInTheDocument()
  expect(select).not.toHaveBeenCalled()
})
it('explains completed as an ended reservation', async () => {
  render(<MantineProvider env="test"><ReservationStatusBadge reservation={{ status: 'approved', is_completed: true }} /></MantineProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Completada' }))
  expect(screen.getByRole('tooltip')).toHaveTextContent('El día de la reserva ya pasó.')
})
