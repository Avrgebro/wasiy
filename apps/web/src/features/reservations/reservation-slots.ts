import type { AvailabilitySlot } from '../locations/amenities-api'

/** Bookings may be placed this far ahead on both surfaces (ADR 0041). */
export const MAX_ADVANCE_DAYS = 90

/**
 * Ends reachable from a chosen start: the end of that slot and of every
 * consecutive free slot after it (a booking is a run of adjacent slots).
 * Stops at the first gap — a taken slot or a break between windows.
 */
export function endOptionsFrom(slots: AvailabilitySlot[], start: string): string[] {
  const index = slots.findIndex((slot) => slot.start === start)
  if (index === -1 || !slots[index].available) return []

  const ends = [slots[index].end]
  for (let next = index + 1; next < slots.length; next++) {
    const slot = slots[next]
    if (!slot.available || slot.start !== slots[next - 1].end) break
    ends.push(slot.end)
  }

  return ends
}
