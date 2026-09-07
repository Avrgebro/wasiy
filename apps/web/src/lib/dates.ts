/**
 * Single-market defaults: the product currently ships es-PE only, and the
 * API's per-location timezone is not yet threaded into date rendering.
 * Lift these into caller-provided values when a second market lands.
 */
const DEFAULT_LOCALE = 'es-PE'
const DEFAULT_TIME_ZONE = 'America/Lima'

export function formatDate(
  value: string | Date,
  locale: string = DEFAULT_LOCALE,
  timeZone: string = DEFAULT_TIME_ZONE,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone,
  }).format(new Date(value))
}

/**
 * "hace 3 h", "hace 6 días", "ahora": the sessions list and other places
 * that care about recency rather than the calendar date.
 */
export function formatRelative(value: string | Date, locale: string = DEFAULT_LOCALE, now: Date = new Date()) {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return locale.startsWith('es') ? 'ahora' : 'now'
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day')
  return rtf.format(Math.round(seconds / (86400 * 30)), 'month')
}
