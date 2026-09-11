import type { Availability } from '../locations/amenities-api'
import { WEEKDAYS } from '../locations/amenity-schedule'

export { MAX_ADVANCE_DAYS } from '../../lib/calendar'

/** True when the amenity has no window on that date's weekday (dates are Y-m-d wall-clock). */
export function closedWeekday(availability: Availability, date: string): boolean {
  const parsed = new Date(`${date}T12:00:00Z`)
  const weekday = WEEKDAYS[(parsed.getUTCDay() + 6) % 7]

  return (availability[weekday] ?? []).length === 0
}
