/**
 * Canonical site metadata. Single source of truth for anything that appears in
 * both the page chrome and the structured data, so the two cannot drift.
 */
export const SITE = {
  /** Production origin. Must match `site` in astro.config.mjs. */
  url: 'https://wasiy.co',
  name: 'Wasiy',
  /** TODO: replace with the registered legal entity + RUC before launch. */
  legalName: 'Wasiy',
  title: 'Wasiy | Software de operación para edificios residenciales',
  description:
    'Visitas, reservas de amenidades y registro del edificio, en orden. El centro de operación para administradoras y juntas de propietarios en Perú.',
  locale: 'es_PE',
  lang: 'es',
  email: 'hola@wasiy.co',
  phone: '+51 1 640 2210',
  city: 'Lima',
  country: 'PE',
  currency: 'PEN',
  ogImage: '/og.png',
} as const;

/** Absolute URL for a site-relative path. */
export const absolute = (path: string) => new URL(path, SITE.url).href;

/**
 * Is this build the canonical production site — the only deployment allowed
 * into a search index?
 *
 * Two independent guards, because either one alone has a hole:
 *
 *  - VERCEL_ENV catches branch/preview deploys (`preview`) and local dev
 *    (`development`), including the crawlable *.vercel.app URLs.
 *  - The host comparison catches a *separate Vercel project* — a staging
 *    project deployed at stage.wasiy.co reports VERCEL_ENV=production,
 *    because it is that project's production. Comparing the project's own
 *    production domain against our canonical host is what stops it.
 *
 * An unset VERCEL_ENV means a local build, which is never publicly served,
 * so it behaves like production to keep local output faithful to prod.
 *
 * Reads `process.env`, not `import.meta.env`: Vite only inlines
 * `import.meta.env.SOME_VAR` when referenced as a literal property path, and
 * the runtime object carries only built-in and PUBLIC_-prefixed values. Since
 * this is a static build, frontmatter runs in Node and process.env has the
 * real Vercel system variables.
 */
export function isCanonicalProduction(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const vercelEnv = env.VERCEL_ENV;

  // Local build (not on Vercel).
  if (vercelEnv === undefined) return true;

  if (vercelEnv !== 'production') return false;

  // On Vercel and claiming production: verify it is *our* production domain.
  const projectHost = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!projectHost) return true; // Nothing to compare against; trust VERCEL_ENV.

  return projectHost.toLowerCase() === new URL(SITE.url).host.toLowerCase();
}

/**
 * Accept a bare host or a full origin. Vercel's own system variables are
 * protocol-less (`VERCEL_URL=foo.vercel.app`), so a host typed into the
 * dashboard without `https://` is the likely case, not the exception.
 */
function toOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withScheme).origin;
}

/**
 * Origin read from a required build-time variable. No fallback on purpose:
 * every environment says explicitly which app and API it links to, and a
 * missing value fails the build instead of guessing.
 *
 * Reads `process.env` for the same reason isCanonicalProduction does; Astro
 * loads `.env` files into it for local builds, Vercel injects dashboard
 * variables. Accepts a bare host or a full origin.
 */
export function requireOrigin(
  name: 'APP_URL' | 'API_URL',
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to apps/marketing/.env for local builds or to the Vercel project's environment variables (see .env.example).`,
    );
  }

  return toOrigin(value);
}

/** Staff app the header "Acceder" and the plan CTAs link to. Resolved once at build time. */
export const APP_URL = requireOrigin('APP_URL');
/** Laravel API the contact and demo forms post to. Resolved once at build time. */
export const API_URL = requireOrigin('API_URL');
