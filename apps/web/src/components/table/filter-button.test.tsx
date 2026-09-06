import { MantineProvider, MultiSelect } from '@mantine/core'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import '../../i18n'
import { FilterButton } from './filter-button'
import { FILTER_COMBOBOX_PROPS } from './filter-combobox-props'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each([false, true])('keeps selection usable and supports clear/done (desktop=%s)', async (desktop) => {
  const original = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ ...original(query), matches: desktop && query === '(min-width: 64rem)' }))
  const visual = new EventTarget()
  Object.assign(visual, { height: 800, width: 1024, offsetTop: 0, offsetLeft: 0, scale: 1 })
  vi.stubGlobal('visualViewport', visual)
  const clear = vi.fn()
  const change = vi.fn()
  const user = userEvent.setup()
  render(<MantineProvider theme={{ components: { Drawer: { defaultProps: { transitionProps: { duration: 0 } } }, Popover: { defaultProps: { hideDetached: false, transitionProps: { duration: 0 } } } } }}><FilterButton activeCount={1} onClearAll={clear}>
    <MultiSelect label="Categoría" searchable data={['Agua', 'Multa']} onChange={change}
      comboboxProps={FILTER_COMBOBOX_PROPS} />
  </FilterButton></MantineProvider>)
  await user.click(screen.getByRole('button', { name: /Filtros/ }))
  const panel = screen.getByRole('dialog', { name: 'Filtros' })
  const input = within(panel).getByRole('combobox', { name: 'Categoría' })
  expect(input).not.toHaveFocus()
  await user.click(input)
  act(() => {
    Object.assign(visual, { height: 350 })
    visual.dispatchEvent(new Event('resize'))
  })
  expect(input).toHaveFocus()
  expect(panel).toBeVisible()
  if (!desktop) {
    expect(panel).toHaveStyle({ maxHeight: '315px' })
    expect(panel.closest('.mantine-Drawer-inner')).toHaveStyle({ bottom: `${window.innerHeight - 350}px` })
    act(() => {
      Object.assign(visual, { offsetTop: 40 })
      visual.dispatchEvent(new Event('scroll'))
    })
    expect(panel.closest('.mantine-Drawer-inner')).toHaveStyle({ bottom: `${window.innerHeight - 390}px` })
    expect(input).toHaveFocus()
  }
  const dropdown = screen.getByRole('option', { name: 'Agua' }).closest('[data-position]')
  expect(panel).not.toContainElement(dropdown as HTMLElement)
  expect(dropdown).toHaveAttribute('data-fixed', 'true')
  await user.type(input, 'Agua')
  await user.click(screen.getByRole('option', { name: 'Agua' }))
  expect(change).toHaveBeenCalledWith(['Agua'])
  await user.click(within(panel).getByRole('button', { name: 'Limpiar filtros' }))
  expect(clear).toHaveBeenCalledOnce()
  await user.click(within(panel).getByRole('button', { name: 'Listo' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
