import type { ReactNode } from 'react'

/**
 * The outlined pill the design uses for location·role access chips —
 * quieter than a filled Badge so rows stay scannable when a person holds
 * several assignments. Built on theme variables so both color schemes work.
 */
export function AccessChip({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-body)] px-2.5 py-1 text-xs font-medium text-[var(--mantine-color-dimmed)]">
      {children}
    </span>
  )
}

/**
 * The tinted sibling of AccessChip for status and role badges. Unlike
 * Mantine's Badge, the label never truncates to an ellipsis in narrow
 * cells — chips keep their full text and let the row scroll instead.
 * Colors come from Mantine's `-light` variant variables, so tints follow
 * the color scheme.
 */
export function TintChip({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: `var(--mantine-color-${color}-light)`,
        color: `var(--mantine-color-${color}-light-color)`,
      }}
    >
      {children}
    </span>
  )
}
