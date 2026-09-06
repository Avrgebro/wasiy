# apps/web — two surfaces, one codebase

The staff app (`app.wasiy.co`) and the resident portal (`portal.wasiy.co`) are two Vite builds of this package (ADR 0038). They must stay independent: neither artifact may contain the other's routes, features or API calls.

## Rules

- Route files: staff under `src/routes-admin`, portal under `src/routes-portal`. Never import across the two trees.
- Feature folders: every folder in `src/features` is classified in `surfaces.json` as `staffFeatures` or `sharedOrPortalFeatures`. Classify any new folder there; `src/features/boundary.test.ts` fails otherwise.
- Portal code (`features/portal`, `routes-portal`, `components/layout/portal`) may import only shared rooms (`components/ui`, `components/table`, `lib`, `app`, `i18n`) plus `features/auth`, `features/invitations` and `features/navigation/spec`. The ESLint boundary rule enforces this.
- Anything in `components/ui` must be feature-free: Mantine, React, `lib`, i18n only. That is what makes it safe for both surfaces (`AppDrawer` is staff-only by use, `BottomSheet` portal-only by use, both live there).
- Cross-surface links use `href` with the other host from `getDefaultAuthenticatedRoute(me, surface)` / `VITE_APP_URL` / `VITE_PORTAL_URL`, never a typed `to`.

## Commands

- `pnpm dev` (5174) / `pnpm dev:portal` (5175); `pnpm build` / `pnpm build:portal`.
- Typecheck both trees with `npx tsc -b`. `tsc -p .` checks nothing.
- Before committing anything that touches `components/`, `features/auth` or the layouts, verify isolation:

```sh
pnpm build && grep -c 'portal/alertas' dist/assets/index-*.js        # expect 0
pnpm build:portal && grep -c 'AppDrawer\|/api/locations/' dist/assets/index-*.js   # expect 0
```

Known and accepted: both bundles ship the whole `common.json`, so staff copy strings appear in the portal bundle. Splitting the locale into a `portal` namespace is a separate task.
