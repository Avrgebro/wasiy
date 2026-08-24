import { createFileRoute } from '@tanstack/react-router'
import { isAccountAdmin } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { LocationDetailPage } from '../../../features/locations/location-detail-page'
import { locationDetailSearchSchema } from '../../../features/locations/schemas'

export const Route = createFileRoute('/_authenticated/admin/locations_/$locationId')({
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, isAccountAdmin)
  },
  component: LocationDetailPage,
  validateSearch: locationDetailSearchSchema,
})
