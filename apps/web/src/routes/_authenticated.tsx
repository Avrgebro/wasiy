import { createFileRoute } from '@tanstack/react-router'
import { requireAuthenticated } from '../features/auth/guards'

// Pathless layout: every route nested under it requires a signed-in, active
// user. The resolved `me` is returned into route context so child guards
// only perform their own surface checks.
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const me = await requireAuthenticated(context, location)

    return { me }
  },
})
