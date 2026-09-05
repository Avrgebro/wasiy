import { createFileRoute } from '@tanstack/react-router'
import { PortalBookingPage } from '../../../features/portal/portal-booking-page'

export const Route = createFileRoute('/_authenticated/portal/reservas_/amenidades/$amenityId_/horario')({
  component: PortalBookingPage,
})
