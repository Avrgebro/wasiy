import { describe, expect, it } from 'vitest'
import { isOpenOn, openDaysLabel, weekdayOf } from './open-days'

const t = (key: string) => {
  const short: Record<string, string> = { monday: 'L', tuesday: 'Ma', wednesday: 'Mi', thursday: 'J', friday: 'V', saturday: 'S', sunday: 'D' }
  if (key === 'amenities.allDays') return 'Todos'

  return short[key.split('.').pop()!] ?? key
}

describe('open days', () => {
  it('maps a date to its weekday key', () => {
    expect(weekdayOf('2026-09-14')).toBe('monday')
    expect(weekdayOf('2026-09-20')).toBe('sunday')
  })

  it('tells open from closed dates', () => {
    expect(isOpenOn(['monday'], '2026-09-14')).toBe(true)
    expect(isOpenOn(['monday'], '2026-09-15')).toBe(false)
  })

  it('summarizes the set', () => {
    expect(openDaysLabel(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], t)).toBe('Todos')
    expect(openDaysLabel(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], t)).toBe('L–V')
    expect(openDaysLabel(['friday', 'monday', 'wednesday'], t)).toBe('L, Mi, V')
    expect(openDaysLabel(['saturday', 'sunday'], t)).toBe('S, D')
    expect(openDaysLabel([], t)).toBe('—')
  })
})
