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
 * Calendar math for the week agenda. Everything works on plain YYYY-MM-DD
 * strings interpreted in the Location's timezone: the API takes local
 * dates, and reservations carry UTC instants that must be regrouped into
 * local days for display.
 */

export function localDateString(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** Monday-based start of the week containing the given local date. */
export function startOfWeek(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  const weekday = parsed.getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  parsed.setUTCDate(parsed.getUTCDate() - daysSinceMonday)

  return parsed.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)

  return parsed.toISOString().slice(0, 10)
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

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

/** "viernes 15" style label for the day-band headers. */
export function longDayLabel(date: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}

/** "11 – 17 de agosto" (or cross-month "30 de agosto – 5 de septiembre"). */
export function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6)
  const dayAndMonth = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  })
  const endLabel = dayAndMonth.format(new Date(`${end}T12:00:00Z`))
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7)
  const startLabel = sameMonth
    ? new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric' }).format(
        new Date(`${weekStart}T12:00:00Z`),
      )
    : dayAndMonth.format(new Date(`${weekStart}T12:00:00Z`))

  return `${startLabel} – ${endLabel}`
}
