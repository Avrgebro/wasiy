import { createFileRoute } from '@tanstack/react-router'
import { ReservationsPage } from '../../../features/reservations/reservations-page'
import { reservationsSearchSchema } from '../../../features/reservations/schemas'

export const Route = createFileRoute('/_authenticated/admin/reservations')({
  component: ReservationsPage,
  validateSearch: reservationsSearchSchema,
})
