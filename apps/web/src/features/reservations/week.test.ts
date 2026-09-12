import { describe, expect, it } from 'vitest'
import { shortDayLabel, startOfWeek, weekDays, weekRangeLabel } from './week'

describe('week helpers', () => {
  it('anchors a week on Monday', () => {
    expect(startOfWeek('2026-09-16')).toBe('2026-09-14') // Wednesday
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14') // Monday
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14') // Sunday
  })

  it('lists the seven days and labels the range', () => {
    expect(weekDays('2026-09-14')).toHaveLength(7)
    expect(weekDays('2026-09-14').at(-1)).toBe('2026-09-20')
    expect(weekRangeLabel('2026-09-14')).toBe('14 – 20 de setiembre')
    expect(weekRangeLabel('2026-09-28')).toBe('28 de setiembre – 4 de octubre')
    expect(shortDayLabel('2026-09-14')).toBe('lun 14')
  })
})
