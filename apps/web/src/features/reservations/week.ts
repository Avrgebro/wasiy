import { addDays, localDateString } from '../../lib/calendar'

export { addDays, localDateString }

/**
 * Calendar math for the reservations week board. Everything works on plain
 * YYYY-MM-DD strings in the Location's calendar: a reservation is a day
 * (ADR 0043), so there are no instants to regroup.
 */

/** The Monday of the week that holds `date`. */
export function startOfWeek(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()

  return addDays(date, -((weekday + 6) % 7))
}

/** The seven days from a Monday. */
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

/** "sáb 16" style short label for a local date. */
export function shortDayLabel(date: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(/\./g, '')
}

/** "viernes 11 de septiembre": the day a booking holds, spelled out. */
export function dayHeading(date: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00Z`))
}

/** "14 – 20 de septiembre" or "28 de septiembre – 4 de octubre": the pager's label. */
export function weekRangeLabel(start: string): string {
  const end = addDays(start, 6)
  const dayMonth = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric', month: 'long' })
  const day = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric' })
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)

  return sameMonth
    ? `${day.format(new Date(`${start}T12:00:00Z`))} – ${dayMonth.format(new Date(`${end}T12:00:00Z`))}`
    : `${dayMonth.format(new Date(`${start}T12:00:00Z`))} – ${dayMonth.format(new Date(`${end}T12:00:00Z`))}`
}
