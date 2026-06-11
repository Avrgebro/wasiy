import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../../features/auth/access'
import { SelectAccountPage } from '../../features/auth/select-account-page'

export const Route = createFileRoute('/_authenticated/select-account')({
  beforeLoad: ({ context }) => {
    if (!requiresAccountSelection(context.me)) {
      throw redirect({ to: getDefaultAuthenticatedRoute(context.me) })
    }
  },
  component: SelectAccountPage,
})
