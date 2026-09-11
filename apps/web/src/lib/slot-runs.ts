export type RunSlot = { start: string; end: string; available: boolean }

/**
 * Durations a booking may take from `start`: one slot, two slots, … up to
 * the closing time of the window the start belongs to. Slots are not
 * exclusive, so only contiguity matters — a break between windows ends the
 * run. Each option carries the resulting `end`.
 */
export function durationOptions(slots: RunSlot[], start: string): { end: string; slots: number }[] {
  const index = slots.findIndex((slot) => slot.start === start)
  if (index === -1) return []

  const options = [{ end: slots[index].end, slots: 1 }]
  for (let next = index + 1; next < slots.length; next++) {
    if (slots[next].start !== slots[next - 1].end) break
    options.push({ end: slots[next].end, slots: options.length + 1 })
  }

  return options
}

/** "45 min", "1 h", "1 h 30 min", "5 h" — unit-agnostic across es/en. */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
