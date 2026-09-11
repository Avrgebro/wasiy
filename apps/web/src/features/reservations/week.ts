import { addDays, localDateString } from '../../lib/calendar'

export { addDays, localDateString }
import type { ReservationSummary } from './api'

/** Indexed by Date#getUTCDay() — the API's availability keys. */
export const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const

/**
 * Calendar math for the reservations board. Everything works on plain
 * YYYY-MM-DD strings interpreted in the Location's timezone: the API takes
 * local dates, and reservations carry UTC instants that must be regrouped into
 * local days for display.
 */



export function formatTimeRange(reservation: ReservationSummary, timezone: string): string {
  const format = new Intl.DateTimeFormat('es-PE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return `${format.format(new Date(reservation.starts_at))}–${format.format(new Date(reservation.ends_at))}`
}

/** "sáb 16" style short label for a local date. */
export function shortDayLabel(date: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}

/** "viernes 11 de septiembre": the board's day heading. */
export function dayHeading(date: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00Z`))
}
