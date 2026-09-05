import { Badge, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { TintChip } from '../../components/ui/chips'

/** The home board card: title, count pill, filled rows, optional "Ver todo". */
export function PortalCard({
  count,
  countColor = 'teal',
  children,
  empty,
  title,
  to,
  viewAllLabel,
}: {
  count?: number
  countColor?: string
  children: ReactNode
  empty?: string
  title: string
  to?: '/portal/visitas' | '/portal/perfil' | '/portal/reservas'
  viewAllLabel?: string
}) {
  const isEmpty = empty !== undefined && count === 0

  return (
    <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="m-0 font-display text-[15px] font-semibold">{title}</h2>
        {count !== undefined ? <TintChip color={countColor}>{count}</TintChip> : null}
      </div>
      {isEmpty ? (
        <Text c="dimmed" className="px-4 pb-4" size="sm">
          {empty}
        </Text>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 px-3 pb-3">{children}</ul>
      )}
      {to && viewAllLabel && !isEmpty ? (
        <div className="border-t border-[var(--mantine-color-default-border)] px-4 py-2.5">
          <Link className="text-[12.5px] font-semibold text-[var(--wa-interactive)] no-underline" to={to}>
            {viewAllLabel}
          </Link>
        </div>
      ) : null}
    </section>
  )
}

/** A filled row inside a card: primary text, secondary line, and a pill on the right. */
export function PortalRow({ pill, primary, secondary, onClick }: { pill?: ReactNode; primary: string; secondary?: string | null; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{primary}</span>
        {secondary ? <span className="truncate text-xs text-[var(--mantine-color-dimmed)]">{secondary}</span> : null}
      </span>
      {pill}
    </>
  )
  const className = 'flex min-h-14 w-full items-center gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-2.5 text-left'

  return (
    <li>
      {onClick ? (
        <button className={`${className} cursor-pointer`} type="button" onClick={onClick}>
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  )
}

export function StatusPill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <Badge color={color} radius="xl" size="sm" variant="light">
      {children}
    </Badge>
  )
}
