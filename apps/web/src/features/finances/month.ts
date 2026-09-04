/**
 * Month arithmetic for the `month=YYYY-MM` URL param. Every value is a plain
 * string so nothing here depends on the browser's timezone; the location's
 * timezone only decides which month "now" falls in.
 */
export function currentMonth(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value

  return `${year}-${month}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "agosto 2026" */
export function monthLabel(month: string, locale = 'es-PE'): string {
  // es-PE yields "agosto de 2026"; the mockup writes "agosto 2026".
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`))
    .replace(' de ', ' ')
}

/** "16 ago" — the ledger's date column. */
/** Some ICU builds render es-PE short dates as "15-ago."; the app wants "15 ago". */
function tidyShort(formatted: string): string {
  return formatted.replace(/\./g, '').replace(/-/g, ' ')
}

export function shortDate(date: string, locale = 'es-PE'): string {
  return tidyShort(
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
  )
}

/** Today's YYYY-MM-DD in the location's timezone. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** "12 ago 2026" for a YYYY-MM-DD ledger date. */
export function longDate(date: string, locale = 'es-PE'): string {
  return tidyShort(
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
  )
}

/** "12 ago · 10:14" for an instant, in the location's timezone. */
export function shortDateTime(iso: string, timezone: string, locale = 'es-PE'): string {
  const date = new Date(iso)
  const day = tidyShort(new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: timezone }).format(date))
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(date)

  return `${day} · ${time}`
}
