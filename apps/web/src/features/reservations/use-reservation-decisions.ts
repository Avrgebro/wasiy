import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notifySuccess } from '../../lib/notify'
import { approveReservation, cancelReservation, observeReservation, rejectReservation } from './api'

export type Decision = 'approve' | 'observe' | 'reject' | 'cancel'

export type DecisionInput = { kind: Decision; reservationId: string; note?: string }

const TOAST: Record<Decision, string> = {
  approve: 'reservations.toasts.approved',
  observe: 'reservations.toasts.observed',
  reject: 'reservations.toasts.rejected',
  cancel: 'reservations.toasts.cancelled',
}

/**
 * The one place a staff decision is sent (ADR 0041): approve, observe,
 * reject, cancel. Observe and reject carry a required note; cancel an
 * optional one. Both the drawer and the Por aprobar rail call this, so the
 * invalidation set and the toasts cannot drift apart. Errors fall through
 * to the app-level mutation handler.
 */
export function useReservationDecisions(accountId: string, onSettled?: (input: DecisionInput) => void | Promise<void>) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kind, reservationId, note }: DecisionInput) => {
      const trimmed = note?.trim() ?? ''
      switch (kind) {
        case 'approve':
          return approveReservation(accountId, reservationId)
        case 'observe':
          return observeReservation(accountId, reservationId, trimmed)
        case 'reject':
          return rejectReservation(accountId, reservationId, trimmed)
        default:
          return cancelReservation(accountId, reservationId, trimmed || undefined)
      }
    },
    onSuccess: async (_response, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['finances'] }),
      ])
      await onSettled?.(input)
      notifySuccess(t(TOAST[input.kind]))
    },
  })
}
