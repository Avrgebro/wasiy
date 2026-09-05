import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PortalReservationsPage } from '../../../features/portal/portal-reservations-page'

/** Mis reservas by default; ?chip=amenidades opens the catalogue (the home's Reservar action); ?reserva= opens one booking's sheet (an alert row). */
export const Route = createFileRoute('/_authenticated/portal/reservas')({
  validateSearch: z.object({ chip: z.enum(['mine', 'amenidades']).catch('mine'), reserva: z.string().optional().catch(undefined) }),
  component: PortalReservationsPage,
})
