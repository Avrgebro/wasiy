import { describe, expect, it } from 'vitest'
import { closedWeekday } from './reservation-slots'

describe('closedWeekday', () => {
  const availability = { monday: [{ start: '09:00', end: '22:00' }] }

  it('is open on a weekday with a window and closed otherwise', () => {
    expect(closedWeekday(availability, '2026-09-14')).toBe(false) // Monday
    expect(closedWeekday(availability, '2026-09-15')).toBe(true) // Tuesday
  })
})
