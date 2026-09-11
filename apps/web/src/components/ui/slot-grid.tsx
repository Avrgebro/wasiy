import { Input } from '@mantine/core'
import { TimeGrid, type TimeGridProps } from '@mantine/dates'
import type { ReactNode } from 'react'
export type SlotGridSlot = { start: string; end: string; available: boolean }

/**
 * The portal's slot picker: the server's slot list rendered as a TimeGrid,
 * past slots disabled (slots are never exclusive; conflicts are the
 * approver's call), one tap picks one slot. Each button shows
 * its start time; the full "start–end" range is the accessible name.
 */
export function SlotGrid({
  slots,
  value,
  onChange,
  label,
  error,
  cols = 3,
  ...props
}: {
  slots: SlotGridSlot[]
  value: string
  onChange: (start: string) => void
  label?: ReactNode
  error?: ReactNode
  cols?: number
} & Omit<TimeGridProps, 'data' | 'value' | 'onChange' | 'disableTime' | 'getControlProps' | 'simpleGridProps'>) {
  const byStart = new Map(slots.map((slot) => [slot.start, slot]))

  return (
    <Input.Wrapper error={error} label={label}>
      <TimeGrid
        allowDeselect={false}
        data={slots.map((slot) => slot.start)}
        disableTime={(time) => !(byStart.get(time)?.available ?? false)}
        getControlProps={(time) => {
          const slot = byStart.get(time)
          return { 'aria-label': slot ? `${slot.start}–${slot.end}` : time, role: 'option', 'aria-selected': time === value }
        }}
        radius="md"
        simpleGridProps={{ cols, spacing: 8 }}
        value={value === '' ? null : value}
        onChange={(next) => onChange(next ?? '')}
        {...props}
      />
    </Input.Wrapper>
  )
}
