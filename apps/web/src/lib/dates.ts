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
