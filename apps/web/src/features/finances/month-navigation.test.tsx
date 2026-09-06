import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import '../../i18n'
import { MonthNavigation } from './month-navigation'

afterEach(cleanup)

it('opens a picker without resetting the month and allows choosing another year', async () => {
  const change = vi.fn()
  const user = userEvent.setup()
  render(<MantineProvider env="test"><MonthNavigation month="2024-08" thisMonth="2026-09" onChange={change} /></MantineProvider>)
  await user.click(screen.getByRole('button', { name: 'agosto 2024' }))
  expect(change).not.toHaveBeenCalled()
  const picker = screen.getByRole('dialog', { name: 'Elegir mes' })
  expect(within(picker).getByRole('button', { name: 'agosto 2024' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(within(picker).getByRole('button', { name: 'Año anterior' }))
  await user.click(within(picker).getByRole('button', { name: 'enero 2023' }))
  expect(change).toHaveBeenLastCalledWith('2023-01')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mes actual' }))
  expect(change).toHaveBeenLastCalledWith(undefined)
})

it('steps across years and blocks future months', async () => {
  const change = vi.fn()
  const user = userEvent.setup()
  const view = render(<MantineProvider env="test"><MonthNavigation month="2026-01" thisMonth="2026-09" onChange={change} /></MantineProvider>)
  await user.click(screen.getByRole('button', { name: 'Mes anterior' }))
  expect(change).toHaveBeenLastCalledWith('2025-12')
  await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
  expect(change).toHaveBeenLastCalledWith('2026-02')
  view.rerender(<MantineProvider env="test"><MonthNavigation month="2026-09" thisMonth="2026-09" onChange={change} /></MantineProvider>)
  expect(screen.getByRole('button', { name: 'Mes actual' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'septiembre 2026' }))
  const picker = screen.getByRole('dialog')
  expect(within(picker).getByRole('button', { name: 'octubre 2026' })).toBeDisabled()
  expect(within(picker).getByRole('button', { name: 'Año siguiente' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
