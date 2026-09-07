import { createFileRoute } from '@tanstack/react-router'
import { isAccountAdmin } from '../../../features/auth/access'
import { checkSurfaceAccess } from '../../../features/auth/guards'
import { SubscriptionPage } from '../../../features/subscription/subscription-page'

export const Route = createFileRoute('/_authenticated/admin/subscription')({
  // Billing is the account admin's; other roles hit the lock screen on a lapse.
  beforeLoad: ({ context }) => {
    checkSurfaceAccess(context.me, isAccountAdmin)
  },
  component: SubscriptionPage,
})
