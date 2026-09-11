import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'

/**
 * Picks a `YYYY-MM-DD` date in a DateField: opens the popover from the
 * input and clicks the day button, paging month by month toward the target
 * when it is not in the visible month (DateField labels days by ISO date and
 * the header arrows by "Mes anterior" / "Mes siguiente").
 */
export async function pickDate(user: UserEvent, input: HTMLElement, date: string) {
  await user.click(input)
  // Day buttons carry ISO labels, unique on the page, so the queries are
  // global: the drawer that holds the field is a dialog too.
  await screen.findAllByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
  const targetMonth = date.slice(0, 7)
  for (let page = 0; page < 24; page++) {
    // A previously closed picker in the same form can still be mounted, so
    // always act on the last calendar in DOM order (portals append).
    const day = screen.queryAllByRole('button', { name: date }).at(-1)
    if (day) {
      await user.click(day)
      return
    }
    const days = screen.getAllByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
    const grid = days.slice(-42)
    const visibleMonth = (grid[Math.floor(grid.length / 2)].getAttribute('aria-label') ?? '').slice(0, 7)
    const direction = visibleMonth < targetMonth ? 'Mes siguiente' : 'Mes anterior'
    await user.click(screen.getAllByRole('button', { name: direction }).at(-1)!)
  }
  throw new Error(`Day ${date} not reachable in the calendar`)
}
