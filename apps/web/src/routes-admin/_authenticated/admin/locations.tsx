import { createFileRoute } from '@tanstack/react-router'
import { isAccountAdmin } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { LocationsPage } from '../../../features/locations/locations-page'
import { locationsSearchSchema } from '../../../features/locations/schemas'

export const Route = createFileRoute('/_authenticated/admin/locations')({
  // The sidebar hides this entry for non-admins, but hiding is not
  // enforcement: a typed URL must be turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, isAccountAdmin)
  },
  component: LocationsPage,
  validateSearch: locationsSearchSchema,
})
