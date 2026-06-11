import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../features/auth/access'
import { requireMe } from '../features/auth/guards'
import { SelectAccountPage } from '../features/auth/select-account-page'

export const Route = createFileRoute('/select-account')({
  beforeLoad: async ({ context, location }) => {
    const me = await requireMe(context, location)

    if (!requiresAccountSelection(me)) {
      throw redirect({ to: getDefaultAuthenticatedRoute(me) })
    }
  },
  component: SelectAccountPage,
})
