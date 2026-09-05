import type { Availability, AvailabilityWindow } from './amenities-api'

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

/** Single-letter labels for the "L–D · 9:00–22:00" summary. */
const DAY_INITIALS: Record<Weekday, string> = {
  monday: 'L',
  tuesday: 'M',
  wednesday: 'X',
  thursday: 'J',
  friday: 'V',
  saturday: 'S',
  sunday: 'D',
}

function formatTime(time: string) {
  return time.startsWith('0') ? time.slice(1) : time
}

/**
 * The table's Horario cell: "L–D · 9:00–22:00" when the week is uniform,
 * "V–D · 12:00–22:00" for a contiguous open range, and "Variable" when the
 * days differ — the drawer holds the real schedule.
 */
export function summarizeAvailability(availability: Availability): string | null {
  const openDays = WEEKDAYS.filter((day) => (availability[day] ?? []).length > 0)

  if (openDays.length === 0) {
    return null
  }

  const signatures = new Set(
    openDays.map((day) => JSON.stringify(availability[day])),
  )
  const contiguous =
    WEEKDAYS.indexOf(openDays[openDays.length - 1]) - WEEKDAYS.indexOf(openDays[0]) ===
    openDays.length - 1

  if (signatures.size !== 1 || !contiguous) {
    return 'variable'
  }

  const windows = availability[openDays[0]] ?? []
  const range =
    openDays.length === 1
      ? DAY_INITIALS[openDays[0]]
      : `${DAY_INITIALS[openDays[0]]}–${DAY_INITIALS[openDays[openDays.length - 1]]}`
  const hours = windows
    .map((window) => `${formatTime(window.start)}–${formatTime(window.end)}`)
    .join(', ')

  return `${range} · ${hours}`
}

/**
 * Mirror of the backend rule in AmenityAvailability: windows sorted by
 * start must not overlap and must close after opening. Returns the first
 * problem's range, or null when the day is valid — the drawer blocks saving
 * while any day reports one, with the server as the authority.
 */
export function findDayConflict(windows: AvailabilityWindow[]): { start: string; end: string } | null {
  const complete = windows.filter((window) => window.start && window.end)

  for (const window of complete) {
    if (window.end <= window.start) {
      return { start: window.start, end: window.end }
    }
  }

  const sorted = [...complete].sort((a, b) => a.start.localeCompare(b.start))

  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index].start < sorted[index - 1].end) {
      return { start: sorted[index].start, end: sorted[index - 1].end }
    }
  }

  return null
}

/** Whether any day currently reports a conflict — the drawer's save guard. */
export function availabilityHasConflicts(value: Availability): boolean {
  return WEEKDAYS.some((day) => findDayConflict(value[day] ?? []) !== null)
}
