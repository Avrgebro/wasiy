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
  to_refund: 'info',
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
    return 'text-[var(--mantine-color-error-light-color)]'
  }
  switch (movement.status) {
    case 'pending':
      return 'text-[var(--mantine-color-accent-light-color)]'
    case 'held':
    case 'to_refund':
      return 'text-[var(--mantine-color-info-light-color)]'
    default:
      return 'text-[var(--mantine-color-success-light-color)]'
  }
}

/**
 * The one transition a row offers inline. Everything else (void, retain,
 * revert) lives in the detail modal, where a wrong click is less likely.
 */
export function primaryTransition(movement: MovementSummary): MovementStatus | null {
  // Only forward moves qualify; reverts stay behind the modal.
  const forward: Record<MovementStatus, MovementStatus[]> = {
    pending: ['paid', 'held'],
    held: ['to_refund'],
    to_refund: ['refunded'],
    paid: [],
    refunded: [],
    retained: [],
    voided: [],
  }

  return forward[movement.status].find((status) => movement.allowed_transitions.includes(status)) ?? null
}

export function transitionLabel(status: MovementStatus, t: TFunction): string {
  return t(`finances.transitions.${status}`)
}
