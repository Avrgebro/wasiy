import { createFileRoute, redirect } from '@tanstack/react-router'
import { getDefaultAuthenticatedRoute } from '../features/auth/access'
import { requireMe } from '../features/auth/guards'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await requireMe(context)

    throw redirect({ to: getDefaultAuthenticatedRoute(me) })
  },
})
