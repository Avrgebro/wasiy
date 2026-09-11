import { describe, expect, it } from 'vitest'
import { durationLabel, durationOptions } from './slot-runs'

const slot = (start: string, end: string) => ({ start, end, available: true })

describe('durationOptions', () => {
  const slots = [slot('09:00', '10:00'), slot('10:00', '11:00'), slot('11:00', '12:00'), slot('15:00', '16:00'), slot('16:00', '17:00')]

  it('runs from the start to the window end, one slot at a time', () => {
    expect(durationOptions(slots, '09:00')).toEqual([
      { end: '10:00', slots: 1 },
      { end: '11:00', slots: 2 },
      { end: '12:00', slots: 3 },
    ])
  })

  it('stops at a break between windows and ignores unknown starts', () => {
    expect(durationOptions(slots, '11:00')).toEqual([{ end: '12:00', slots: 1 }])
    expect(durationOptions(slots, '15:00')).toEqual([{ end: '16:00', slots: 1 }, { end: '17:00', slots: 2 }])
    expect(durationOptions(slots, '08:00')).toEqual([])
  })
})

describe('durationLabel', () => {
  it('formats minutes and hours', () => {
    expect(durationLabel(45)).toBe('45 min')
    expect(durationLabel(60)).toBe('1 h')
    expect(durationLabel(90)).toBe('1 h 30 min')
    expect(durationLabel(300)).toBe('5 h')
  })
})
