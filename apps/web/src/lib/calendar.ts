/**
 * Wall-clock calendar helpers shared by both surfaces. Dates are `Y-m-d`
 * strings in the location's calendar; the noon-UTC trick keeps arithmetic
 * off any DST edge.
 */

/** Bookings may be placed this far ahead on both surfaces (ADR 0041). */
export const MAX_ADVANCE_DAYS = 90

export function localDateString(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)

  return parsed.toISOString().slice(0, 10)
}
