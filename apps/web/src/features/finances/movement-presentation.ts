import type { TFunction } from 'i18next'
import type { MovementStatus, MovementSummary } from './api'

/**
 * Presentation rules the table and the detail modal share so a row and its
 * modal never disagree about a color or a label.
 */
export function statusLabel(movement: Pick<MovementSummary, 'status' | 'direction'>, t: TFunction): string {
  if (movement.status === 'pending') {
    return t(movement.direction === 'expense' ? 'finances.statuses.payable' : 'finances.statuses.pending')
  }

  return t(`finances.statuses.${movement.status}`)
}

const STATUS_COLORS: Record<MovementStatus, string> = {
  pending: 'warning',
  paid: 'success',
  held: 'info',
  refunded: 'success',
  retained: 'gray',
  voided: 'gray',
}

export function statusColor(status: MovementStatus): string {
  return STATUS_COLORS[status]
}

/** Tailwind text classes for the Monto column, mirroring mockup 10. */
export function amountClassName(movement: Pick<MovementSummary, 'status' | 'direction'>): string {
  if (movement.status === 'voided' || movement.status === 'retained') {
    return 'text-[var(--mantine-color-dimmed)] line-through'
  }
  if (movement.direction === 'expense') {
    return 'text-[var(--wa-error)]'
  }
  switch (movement.status) {
    case 'pending':
      return 'text-[var(--wa-accent)]'
    case 'held':
      // Deposits in hand use the mockup's teal (interactive), not info blue.
      return 'text-[var(--wa-interactive)]'
    default:
      return 'text-[var(--wa-success)]'
  }
}

/**
 * The one forward move a row offers inline (ADR 0034, revised): pending goes
 * to paid or held, a held deposit to refunded. Void and undo stay behind the
 * drawer, where a wrong click is less likely.
 */
export function primaryTransition(movement: MovementSummary): MovementStatus | null {
  const forward: Record<MovementStatus, MovementStatus[]> = {
    pending: ['paid', 'held'],
    held: ['refunded'],
    paid: [],
    refunded: [],
    retained: [],
    voided: [],
  }

  return forward[movement.status].find((status) => movement.allowed_transitions.includes(status)) ?? null
}

/** The single step back a settled row offers: paid or held → pending, retained → held. */
export function undoTransition(movement: MovementSummary): MovementStatus | null {
  const back: Partial<Record<MovementStatus, MovementStatus>> = { paid: 'pending', held: 'pending', retained: 'held' }
  const target = back[movement.status]

  return target && movement.allowed_transitions.includes(target) ? target : null
}

export function transitionLabel(status: MovementStatus, t: TFunction): string {
  return t(`finances.transitions.${status}`)
}
