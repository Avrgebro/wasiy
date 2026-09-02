import type { FilterChip } from './filter-chips'

export type FilterChipDef = {
  key: string
  /** Dimension name shown before the colon. */
  label: string
  /** The applied URL search value; no chip is built while it's empty. */
  value: string | undefined
  /** Options the value is resolved against; falls back to the raw value. */
  options: { value: string; label: string }[]
  onRemove: () => void
}

/**
 * Collapses the per-filter "if applied, resolve label, push chip" blocks the
 * filter toolbars all repeat into one declarative list.
 */
export function buildFilterChips(defs: FilterChipDef[]): FilterChip[] {
  return defs.flatMap((def) => {
    if (!def.value) {
      return []
    }

    const valueLabel =
      def.options.find((option) => option.value === def.value)?.label ?? def.value

    return [{ key: def.key, label: `${def.label}: ${valueLabel}`, onRemove: def.onRemove }]
  })
}
