import { describe, expect, it } from 'vitest'
import type { AvailabilitySlot } from '../locations/amenities-api'
import { endOptionsFrom } from './reservation-slots'

const slot = (start: string, end: string, available = true): AvailabilitySlot => ({ start, end, available, reason: available ? null : 'taken' })

describe('endOptionsFrom', () => {
  const slots = [slot('09:00', '10:00'), slot('10:00', '11:00'), slot('11:00', '12:00', false), slot('12:00', '13:00'), slot('15:00', '16:00'), slot('16:00', '17:00')]

  it('offers the chosen slot end and every consecutive free slot end, stopping at a taken slot', () => {
    expect(endOptionsFrom(slots, '09:00')).toEqual(['10:00', '11:00'])
  })

  it('stops at a gap between windows', () => {
    expect(endOptionsFrom(slots, '12:00')).toEqual(['13:00'])
    expect(endOptionsFrom(slots, '15:00')).toEqual(['16:00', '17:00'])
  })

  it('offers nothing for an unknown or taken start', () => {
    expect(endOptionsFrom(slots, '11:00')).toEqual([])
    expect(endOptionsFrom(slots, '08:00')).toEqual([])
  })
})
