import { forwardRef } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'

const CHIP_CLASS =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-body)] px-2.5 py-1 text-xs font-medium'

/**
 * The outlined pill the design uses for location·role access chips —
 * quieter than a filled Badge so rows stay scannable when a person holds
 * several assignments. Built on theme variables so both color schemes work.
 */
export function AccessChip({ children }: { children: ReactNode }) {
  return <span className={`${CHIP_CLASS} text-[var(--mantine-color-dimmed)]`}>{children}</span>
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

type StatusPillProps = {
  /** Semantic role name (`success`, `warning`, `error`, `info`, `teal`, `accent`, `gray`). */
  color: string
  component?: 'span' | 'button'
  type?: 'button'
  children: ReactNode
} & Omit<HTMLAttributes<HTMLElement>, 'color' | 'children'>

/**
 * The status pill, everywhere (tables, drawers, cards): the AccessChip
 * outline — default border, body fill, 12px medium sentence case — with the
 * role color on the text only. The outline carries the shape, so the pill
 * never depends on a surface step and never collides with a band or a hover;
 * the label never ellipsizes, the row scrolls instead. Pass `component="button"`
 * for an interactive pill (tooltips); extra props reach the element.
 */
export const StatusPill = forwardRef<HTMLElement, StatusPillProps>(function StatusPill(
  { color, component, className, children, style, ...rest },
  ref,
) {
  const Tag = component ?? 'span'
  return (
    <Tag
      ref={ref as never}
      className={`${CHIP_CLASS} ${className ?? ''}`}
      style={{ color: PILL_TEXT[color] ?? PILL_TEXT.teal, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
})
