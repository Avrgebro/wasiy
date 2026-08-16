import { getDefaultAuthenticatedRoute } from '../auth/access'
import type { MeResponse } from '../auth/types'

/**
 * Where to send someone right after accepting/claiming an invitation.
 * Without a session the accept still succeeded, so they go sign in rather
 * than into a surface they cannot load yet.
 */
export function postInvitationRoute(session: MeResponse | null) {
  return session ? getDefaultAuthenticatedRoute(session) : ('/login' as const)
}
