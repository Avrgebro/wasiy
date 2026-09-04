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

const PILL_TEXT: Record<string, string> = {
  success: 'var(--wa-success)',
  warning: 'var(--wa-warning)',
  error: 'var(--wa-error)',
  info: 'var(--wa-info)',
  accent: 'var(--wa-accent)',
  teal: 'var(--wa-interactive)',
  gray: 'var(--mantine-color-dimmed)',
}

/**
 * The status pill for cells where a Badge would truncate: same recipe as the
 * theme's `light` Badge — role-colored text on the neutral second surface —
 * but the label never ellipsizes; the row scrolls instead.
 */
export function TintChip({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: 'var(--wa-surface-2)', color: PILL_TEXT[color] ?? PILL_TEXT.teal }}
    >
      {children}
    </span>
  )
}
