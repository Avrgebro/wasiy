/**
 * Weekday helpers for the day model (ADR 0043). Amenities carry `open_days`
 * as weekday keys; both surfaces need to know whether a `Y-m-d` date falls
 * on one and how to summarize the set, so this lives in the shared room.
 */

/** Monday first — the order the form, the week board and the labels use. */
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

/** Weekday key of a wall-clock `Y-m-d` date (noon UTC keeps it off DST edges). */
export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]
}

/** True when the amenity opens on that date's weekday. */
export function isOpenOn(openDays: readonly string[], date: string): boolean {
  return openDays.includes(weekdayOf(date))
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * "Todos" when all seven, "L–V" for a contiguous run of three or more,
 * "L, Mi, V" otherwise, "—" when none. Short names come from i18n so both
 * locales read naturally.
 */
export function openDaysLabel(openDays: readonly string[], t: Translate): string {
  const days = WEEKDAYS.filter((day) => openDays.includes(day))
  if (days.length === 0) return '—'
  if (days.length === WEEKDAYS.length) return t('amenities.allDays')

  const short = (day: Weekday) => t(`amenities.weekdaysShort.${day}`)
  const first = WEEKDAYS.indexOf(days[0])
  const last = WEEKDAYS.indexOf(days[days.length - 1])
  const contiguous = last - first === days.length - 1

  if (contiguous && days.length >= 3) {
    return `${short(days[0])}–${short(days[days.length - 1])}`
  }

  return days.map(short).join(', ')
}
