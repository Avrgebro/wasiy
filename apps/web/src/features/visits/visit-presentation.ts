import type { TFunction } from 'i18next'
import type { VisitSummary } from './api'

/** "2 h 12 min" between check-in and now (or check-out). */
export function durationLabel(visit: VisitSummary, now: Date, t: TFunction): string {
  const end = visit.checked_out_at ? new Date(visit.checked_out_at) : now
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(visit.checked_in_at).getTime()) / 60000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return hours > 0 ? t('visits.duration.hoursMinutes', { hours, minutes: rest }) : t('visits.duration.minutes', { minutes: rest })
}

/** "10:24" today, "14 ago · 18:05" otherwise. */
export function checkInLabel(iso: string, timezone: string, now: Date, locale = 'es-PE'): string {
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(date)
  const sameDay =
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  if (sameDay) {
    return time
  }
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: timezone }).format(date).replace(/\./g, '').replace(/-/g, ' ')

  return `${day} · ${time}`
}
