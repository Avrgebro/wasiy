import { createFileRoute, redirect } from '@tanstack/react-router'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { requireAuthenticated } from '../features/auth/guards'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await requireAuthenticated(context)

    throw redirect({ to: getDefaultAuthenticatedRoute(me) })
  },
})
