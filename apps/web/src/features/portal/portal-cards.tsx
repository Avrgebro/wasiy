import { Badge, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AccessChip } from '../../components/ui/chips'

/**
 * The portal card (Portal 01, 04), measured from the artboards: 14px radius,
 * 11/12/9 padding, 7px between blocks. Header is title then count, side by
 * side with an 8px gap. Rows are filled, 10px radius, 6px apart. The footer
 * is a right-aligned link or action with no rule above it.
 */
export function PortalCard({
  action,
  count,
  children,
  empty,
  title,
  to,
  viewAllLabel,
}: {
  /** A footer action where "Ver todo" goes (04: Agregar persona, Agregar vehículo). */
  action?: { label: string; onClick: () => void }
  count?: number
  children: ReactNode
  empty?: string
  title: string
  to?: '/portal/visitas' | '/portal/perfil' | '/portal/reservas' | '/portal/mi-unidad' | '/portal/mi-unidad/estado-de-cuenta'
  viewAllLabel?: string
}) {
  const isEmpty = empty !== undefined && count === 0
  const footerClass = 'cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-[var(--wa-interactive)] no-underline'

  return (
    <section className="flex flex-col gap-[7px] rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-3 pt-[11px] pb-[9px]">
      <div className="flex items-center gap-2">
        <h2 className="m-0 font-display text-[14.5px] font-semibold tracking-tight">{title}</h2>
        {count !== undefined ? <AccessChip>{count}</AccessChip> : null}
      </div>
      {isEmpty ? (
        <Text c="dimmed" size="sm">
          {empty}
        </Text>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{children}</ul>
      )}
      {(to && viewAllLabel && !isEmpty) || action ? (
        <div className="flex justify-end">
          {action ? (
            <button className={footerClass} type="button" onClick={action.onClick}>
              {action.label}
            </button>
          ) : (
            <Link className={footerClass} to={to!}>
              {viewAllLabel}
            </Link>
          )}
        </div>
      ) : null}
    </section>
  )
}

/** A filled row inside a card (01): primary 13.5px, secondary 11.5px, pill on the right. */
export function PortalRow({ pill, primary, secondary, onClick }: { pill?: ReactNode; primary: string; secondary?: string | null; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-semibold">{primary}</span>
        {secondary ? <span className="mt-0.5 truncate text-[11.5px] text-[var(--mantine-color-dimmed)]">{secondary}</span> : null}
      </span>
      {pill}
    </>
  )
  const className = 'flex w-full items-center gap-2.5 rounded-[10px] bg-[var(--wa-surface-2)] px-3 py-2.5 text-left'

  return (
    <li>
      {onClick ? (
        <button className={`${className} cursor-pointer border-0`} type="button" onClick={onClick}>
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
