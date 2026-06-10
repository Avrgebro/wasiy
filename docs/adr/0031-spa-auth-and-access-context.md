# SPA Auth and Access Context

Wasiy will treat Laravel Fortify and Sanctum as the single authentication authority for the React SPA, using cookie-based session auth instead of a dedicated frontend auth library. The frontend will use an Axios API client configured for Sanctum credentials and XSRF headers, TanStack Query as the source of truth for `/api/me`, TanStack Router route guards for protected surfaces, and centralized access helpers for Account, Location, and role decisions.

These decisions keep browser state subordinate to backend authorization, avoid duplicating Laravel auth behavior in the React app, and create a stable path from the M1 tracer bullet to M2 multi-account and multi-location navigation.

## Decisions

- Do not add a dedicated frontend auth library such as Auth.js, Clerk, or NextAuth. Laravel Fortify and Sanctum own authentication.
- Use Axios for API transport because Sanctum cookie auth depends on credentialed requests and `XSRF-TOKEN` to `X-XSRF-TOKEN` header handling.
- Follow Sanctum's documented SPA flow: explicitly request `/sanctum/csrf-cookie` before login and let Axios handle credentialed requests plus the `XSRF-TOKEN` to `X-XSRF-TOKEN` header.
- Keep cross-cutting transport behavior in `src/app/api-client.ts`.
- Put auth feature code under `src/features/auth/`, including API calls, hooks, query options, schemas, types, access helpers, and the login page.
- Use `/api/me` as the frontend auth and access-context bootstrap endpoint.
- Let TanStack Query own `/api/me` server state through a stable auth query key. Do not duplicate that state in a separate React auth context.
- Protect route groups with TanStack Router `beforeLoad` guards instead of only checking auth inside components.
- Redirect guests to `/login` before protected layouts render.
- Redirect authenticated users away from `/login` to their default allowed surface.
- Use React Hook Form and Zod for the login form so the first real form establishes the v1 form pattern.
- Normalize Laravel validation errors into field errors and general messages, without parsing translated strings for control flow.
- Fix Fortify JSON failed-login behavior so SPA login receives predictable Laravel-style validation errors for `Accept: application/json` requests.
- Represent frontend roles with literal constants and types that mirror backend enum values, not TypeScript `enum`.
- Centralize access checks in auth helpers such as `hasAccountRole`, `hasLocationRole`, `canAccessAdmin`, `getDefaultAuthenticatedRoute`, and `getDefaultLocation`.
- For M1, derive the active Account and active Location from `/api/me`, because the tracer bullet has one assigned Location.
- For M1, keep the route as `/admin`; derive the dashboard Location internally instead of putting the Location ID in the route.
- For M2, persist active Account and active Location server-side through explicit context endpoints. Browser storage may remember a preference, but it must not be the source of authorization truth.
- Protected shells should wait for auth context before rendering dashboard UI to avoid route flicker.

## M1 Shape

The M1 frontend should authenticate by requesting `/sanctum/csrf-cookie`, posting credentials to Fortify `/login`, invalidating or refetching the `['auth', 'me']` query, deriving the default Location from `/api/me`, and fetching the Location dashboard metric from the protected backend endpoint.

The Location Manager tracer bullet should render `/admin` for the seeded user and show Spanish UI copy, the assigned Location name, and one real metric from the API.

## M2 Context Direction

When users can access multiple Accounts or Locations, the frontend should not rely on `localStorage` as the source of active context. The backend should expose explicit endpoints to set active Account and active Location context, and `/api/me` should return the selected context alongside all accessible Accounts, assigned Locations, roles, and resident membership placeholders.

Active Account is a session-owned required workspace context. Active Location is a session-owned default operational scope inside the Active Account, but location-scoped routes and mutations should still identify and authorize the concrete Location they operate on. `/api/me` auto-selects the only accessible Account, requires explicit selection when multiple Accounts are accessible, scopes roles and accessible Locations to the Active Account, and clears stale session context before applying those selection rules.
