import { createFileRoute } from '@tanstack/react-router'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { redirectWithinSurface, requireAuthenticated } from '../features/auth/guards'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await requireAuthenticated(context)

    throw redirectWithinSurface(getDefaultAuthenticatedRoute(me))
  },
})
