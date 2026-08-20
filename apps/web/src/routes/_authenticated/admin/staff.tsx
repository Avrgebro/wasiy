import { createFileRoute } from '@tanstack/react-router'
import { isAccountAdmin } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { staffSearchSchema } from '../../../features/staff/schemas'
import { StaffPage } from '../../../features/staff/staff-page'

export const Route = createFileRoute('/_authenticated/admin/staff')({
  // The sidebar hides this entry, but hiding is not enforcement: a typed URL
  // must be turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, isAccountAdmin)
  },
  component: StaffPage,
  validateSearch: staffSearchSchema,
})
