import type { TFunction } from 'i18next'
import type { PortalVisit } from './api'

function dayKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function time(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(iso))
}

/** "jue 4" from a Y-m-d date. */
export function shortDay(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace(/\./g, '')
}

/** "Hoy · 19:00", "sáb 6 · sin hora" — when the resident expects the visitor. */
export function expectedLabel(visit: PortalVisit, now: Date, timezone: string, t: TFunction) {
  if (!visit.expected_on) return ''
  const day = visit.expected_on === dayKey(now, timezone) ? t('portal.visits.today') : shortDay(visit.expected_on)

  return `${day} · ${visit.expected_time ?? t('portal.visits.noTime')}`
}

/** "mar 2 · 18:05 → 20:30" — what happened at the door. */
export function doorLabel(visit: PortalVisit, timezone: string) {
  if (!visit.checked_in_at) return ''
  const day = shortDay(dayKey(new Date(visit.checked_in_at), timezone))
  const out = visit.checked_out_at ? ` → ${time(visit.checked_out_at, timezone)}` : ''

  return `${day} · ${time(visit.checked_in_at, timezone)}${out}`
}

export function arrivedAt(visit: PortalVisit, timezone: string) {
  return visit.checked_in_at ? time(visit.checked_in_at, timezone) : ''
}

/** The pill: Esperado (neutral), Llegó (success), Cancelado (dimmed). */
export function statusTone(status: PortalVisit['status']): 'gray' | 'success' | 'teal' {
  if (status === 'cancelled') return 'gray'
  if (status === 'expected') return 'teal'

  return 'success'
}

export function monthHeading(iso: string, timezone: string) {
  const label = new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: timezone }).format(new Date(iso))

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function utcMidnight(date: Date, timezone: string) {
  const [year, month, day] = dayKey(date, timezone).split('-').map(Number) as [number, number, number]

  return Date.UTC(year, month - 1, day)
}

/** "hace 2 días" for packages, from the received timestamp. */
export function ageLabel(iso: string, now: Date, timezone: string, t: TFunction) {
  const days = Math.round((utcMidnight(now, timezone) - utcMidnight(new Date(iso), timezone)) / 86_400_000)
  if (days <= 0) return t('portal.age.today')
  if (days === 1) return t('portal.age.yesterday')

  return t('portal.age.days', { count: days })
}

/** Status pill color for a booking; completed approved ones read as neutral history. */
export function reservationTone(status: string, completed = false): 'success' | 'warning' | 'info' | 'error' | 'gray' {
  if (completed) return 'gray'
  switch (status) {
    case 'approved':
      return 'success'
    case 'pending':
      return 'warning'
    case 'observed':
      return 'info'
    case 'rejected':
      return 'error'
    default:
      return 'gray'
  }
}

/** "lunes 5 de octubre": a booking's day, in rows, the sheet and the booking page. */
export function longDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  return new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

/** "hace 5 min", "hace 2 h", "ayer", then "lun 1": the age column of an alert row (mockup 03b). */
export function alertAge(iso: string, now: Date, timezone: string, t: TFunction) {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return t('portal.alerts.age.minutes', { count: minutes })
  const days = Math.round((utcMidnight(now, timezone) - utcMidnight(new Date(iso), timezone)) / 86_400_000)
  if (days <= 0) return t('portal.alerts.age.hours', { count: Math.round(minutes / 60) })
  if (days === 1) return t('portal.age.yesterday')

  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', timeZone: timezone }).format(new Date(iso)).replace('.', '')
}
