import { createFileRoute } from '@tanstack/react-router'
import { isAccountAdmin } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { AccountSettingsPage } from '../../../features/locations/account-settings-page'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  // The sidebar hides this entry, but hiding is not enforcement: a typed URL
  // must be turned away too.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, isAccountAdmin)
  },
  component: AccountSettingsPage,
})
