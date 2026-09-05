import type { Surface } from '../features/auth/access'

/**
 * Which surface this build serves. Set by Vite mode: `vite --mode portal`
 * is the resident portal; every other mode is the staff app. The route tree,
 * HTML title and manifest follow it at build time (see vite.config.ts), so
 * the portal artifact carries no staff code and vice versa.
 */
export const SURFACE: Surface = import.meta.env.VITE_SURFACE === 'portal' ? 'portal' : 'admin'
