import { getDefaultAuthenticatedRoute, type Surface } from '../auth/access'
import type { MeResponse } from '../auth/types'

/**
 * Where to send someone right after accepting/claiming an invitation.
 * Without a session the accept still succeeded, so they go sign in rather
 * than into a surface they cannot load yet. The surface is the page's own:
 * a resident invitation always leads into the portal, a staff one into the
 * staff app, whichever host served the page.
 */
export function postInvitationRoute(session: MeResponse | null, surface: Surface) {
  return session ? getDefaultAuthenticatedRoute(session, surface) : ('/login' as const)
}
