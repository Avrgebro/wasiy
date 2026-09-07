import { createFileRoute } from '@tanstack/react-router'
import {
  getDefaultAuthenticatedRoute,
  requiresAccountSelection,
} from '../../features/auth/access'
import { redirectWithinSurface } from '../../features/auth/guards'
import { SelectAccountPage } from '../../features/auth/select-account-page'

export const Route = createFileRoute('/_authenticated/select-account')({
  beforeLoad: ({ context }) => {
    if (!requiresAccountSelection(context.me)) {
      throw redirectWithinSurface(getDefaultAuthenticatedRoute(context.me))
    }
  },
  component: SelectAccountPage,
})
