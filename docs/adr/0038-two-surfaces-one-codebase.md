# Two Surfaces, One Codebase

The staff app and the resident portal are two build artifacts of one Vite project. `vite build` produces the staff app from `src/routes-admin`; `vite build --mode portal` produces the portal from `src/routes-portal`. Each artifact contains only its own route tree plus the shared rooms, and is deployed to its own host (`app.wasiy.co`, `portal.wasiy.co`) from its own Vercel project. Accounts, sessions and the API stay unified.

Residents are the larger, less technical audience and arrive on phones; they deserve a login page and an installable app that speak to them, without staff wording. A second repository or package would have bought that isolation by duplicating the design system, the API client, auth and i18n plumbing, and letting them drift. A build-time split gives the same isolation from one codebase.

## Decisions

- **Surface by Vite mode.** `vite.config.ts` derives the surface from the mode and sets `VITE_SURFACE`, the HTML title and the manifest path as process env, which Vite exposes to `import.meta.env` and to `%VITE_*%` placeholders in `index.html`. No `.env` files are involved (the repo ignores them for secrets). `src/app/surface.ts` exposes `SURFACE` for the few runtime decisions (landing route, account selection).
- **One route tree per build.** The router plugin generates `routeTree.admin.gen.ts` or `routeTree.portal.gen.ts` from the surface's folder; both files are committed. Code imports the tree through the `@surface/routeTree` alias, resolved by Vite and by two tsconfigs (`tsconfig.app.json` for staff, `tsconfig.portal.json` for the portal). `tsc -b` checks both.
- **Landing routes travel as `href`.** `getDefaultAuthenticatedRoute(me, surface)` returns the surface's own landing page; a resident on the staff host and a manager on the portal host land on `/no-access`. Redirects to it use `href`, since a typed `to` would drag the other surface's literals into the build.
- **Import boundary in ESLint.** Portal code (`features/portal`, `routes-portal`, `components/layout/portal`) may import shared rooms (`components`, `lib`, `app`, `i18n`), `features/auth`, the navigation spec and the invitation pages, and itself; never a staff feature or the staff shell. Staff code never imports the portal. Staff features are listed explicitly in `surfaces.json` because gitignore-style negations cannot re-include paths under an excluded directory; `src/features/boundary.test.ts` fails when a new feature folder is not classified.
- **Navigation split.** `features/navigation/spec.ts` holds the generic spec types and filter; `admin-navigation.ts` the staff menu; `features/portal/navigation.ts` the portal tabs. `surfaceRouteOptions` receives the navigation function.
- **Login is unified.** One users table, one endpoint, one cookie scoped to the parent domain. The dead "Personal / Residentes" switcher is removed; each host has exactly one audience.

## Consequences

Two dev servers (`pnpm dev`, `pnpm dev:portal`) on ports 5174 and 5175. Vercel: the existing project builds with `pnpm build`; the portal project uses `pnpm build:portal`; no dashboard variables are needed. The API's session cookie domain and stateful domains must include both hosts when the portal host goes live. Verified on 2026-09-05: the portal bundle contains no staff route or feature code and the staff bundle no portal code. The i18n bundle is still shared; a `portal` namespace can split it when the portal grows.
