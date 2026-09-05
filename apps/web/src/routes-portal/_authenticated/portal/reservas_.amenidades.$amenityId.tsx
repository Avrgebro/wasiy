import { createFileRoute } from '@tanstack/react-router'
import { PortalAmenityPage } from '../../../features/portal/portal-amenity-page'

export const Route = createFileRoute('/_authenticated/portal/reservas_/amenidades/$amenityId')({
  component: PortalAmenityPage,
})
