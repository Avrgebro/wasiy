import type { TFunction } from 'i18next'

function dayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function timeOf(date: Date, timezone: string, locale = 'es-PE'): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(date)
}

/** Whole days between two instants as seen on the location's calendar. */
export function calendarDaysAgo(iso: string, now: Date, timezone: string): number {
  return Math.max(0, Math.round((utcMidnight(now, timezone) - utcMidnight(new Date(iso), timezone)) / 86_400_000))
}

/** The location-calendar day of `date` as a UTC midnight, so day arithmetic ignores DST and month lengths. */
function utcMidnight(date: Date, timezone: string): number {
  const [year, month, day] = dayKey(date, timezone).split('-').map(Number) as [number, number, number]

  return Date.UTC(year, month - 1, day)
}

/** The activity feed's left column: "hace 12 min", "hace 2 h", "ayer 18:24", "hace 3 días". */
export function relativeLabel(iso: string, now: Date, timezone: string, t: TFunction): string {
  const date = new Date(iso)
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000))
  if (minutes < 1) return t('dashboard.relative.now')
  if (minutes < 60) return t('dashboard.relative.minutes', { count: minutes })
  const days = calendarDaysAgo(iso, now, timezone)
  if (days === 0) return t('dashboard.relative.hours', { count: Math.floor(minutes / 60) })
  if (days === 1) return t('dashboard.relative.yesterday', { time: timeOf(date, timezone) })

  return t('dashboard.relative.days', { count: days })
}

/** How long a package has waited: "hoy 09:40", "ayer", "hace 5 días". */
export function packageAgeLabel(iso: string, now: Date, timezone: string, t: TFunction): string {
  const days = calendarDaysAgo(iso, now, timezone)
  if (days === 0) return t('dashboard.relative.today', { time: timeOf(new Date(iso), timezone) })
  if (days === 1) return t('dashboard.age.yesterday')

  return t('dashboard.relative.days', { count: days })
}

/** The oldest package as a bare age for the tile caption: "hoy", "ayer", "5 días". */
export function bareAgeLabel(iso: string, now: Date, timezone: string, t: TFunction): string {
  const days = calendarDaysAgo(iso, now, timezone)
  if (days === 0) return t('dashboard.age.today')
  if (days === 1) return t('dashboard.age.yesterday')

  return t('dashboard.age.days', { count: days })
}

