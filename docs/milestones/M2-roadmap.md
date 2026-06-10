# M2 Roadmap: Account, Location, Roles, and Navigation Foundation

## Goal

M2 establishes the access model that later workflows depend on: account context, location context, staff roles, route-aware navigation, and product activity logging.

The main risk is building screens before the permission model is stable. Treat M2 as an authorization and context milestone first, then add the minimum UI needed to prove it.

## Current Starting Point

Already present from M1:

- Account, Location, AccountUserRole, and LocationUserRole tables.
- Account Admin and Location roles represented in enums.
- `/api/me` returns user, accounts, roles, assigned locations, and an empty resident memberships placeholder.
- Location dashboard route is protected by Sanctum and a Location policy.
- Admin route has a protected frontend guard.
- Admin, front-desk, and portal route groups exist as frontend scaffolding.
- Location switcher exists as a placeholder using the first assigned location.

Still missing for M2:

- Server-owned active account and active location context.
- Account selection flow for multi-account users.
- Real location switching within the active account.
- Staff invitation foundation.
- Staff role and location assignment management.
- Front Desk route guards and default routing.
- Role-aware navigation derived from access context.
- Activity logging service and role-change events.

## Implementation Strategy

Build M2 in vertical slices, but start with the access contract. Every UI decision should be derived from `/api/me` and backend-authorized context endpoints. Browser storage can remember a preference later, but it must not be the source of authorization truth.

Recommended order:

1. Access context contract.
2. Authorization helpers and policies.
3. Staff invitation and assignment API.
4. Activity logging foundation.
5. Frontend account and location selection.
6. Role-aware route guards and navigation.
7. Acceptance tests and seed scenarios.

## Slice 1: Access Context Contract

Status: Implemented.

Decision summary:

- Active Account is session-owned required workspace context.
- Active Location is session-owned default operational scope.
- Location-scoped routes and mutations still identify the concrete Location.
- `/api/me` auto-selects the only accessible Account and requires explicit selection when multiple Accounts are accessible.
- `/api/me` returns `accessible_locations`, scoped to the Active Account.
- Account Admin has implicit access to all active Locations in the Active Account.
- Context mutation endpoints return the full `/api/me` payload.

### Backend

- Implemented explicit session-backed context endpoints:
  - `POST /api/context/account`
  - `POST /api/context/location`
  - `DELETE /api/context`
- `AccessContextService` is the backend module that resolves the access-context payload and should be the starting point for Slice 2 authorization helper extraction.
- Protected API routes now include `web` middleware because Active Account and Active Location are session-backed.
- Context session keys:
  - `wasiy.active_account_id`
  - `wasiy.active_location_id`
- `POST /api/context/account` validates that the Account is accessible, sets Active Account, clears Active Location, and auto-selects a single accessible Location when exactly one exists.
- `POST /api/context/location` requires an Active Account, validates that the Location belongs to the Active Account, and validates that the User can access that Location.
- `DELETE /api/context` clears both Active Account and Active Location.
- Context mutation endpoints return the full `/api/me` payload so frontend callers can update route/navigation state from one response.
- `/api/me` now returns:
  - all accessible accounts
  - `active_account`
  - `active_location`
  - account roles
  - location roles
  - `accessible_locations`, filtered by Active Account
  - resident memberships placeholder
- When no Active Account exists, `/api/me` returns all accessible Accounts but empty roles and empty `accessible_locations`.
- When exactly one Account is accessible, `/api/me` auto-selects it and stores it in session.
- When multiple Accounts are accessible, `/api/me` requires explicit Account selection.
- When session context is stale, `/api/me` clears invalid context before applying the normal selection rules.

### Contract Shape

Important response fields for Slice 2:

```json
{
  "accounts": [],
  "active_account": null,
  "active_location": null,
  "roles": {
    "account": [],
    "location": []
  },
  "accessible_locations": [],
  "resident_memberships": []
}
```

`accessible_locations` items include:

```json
{
  "id": "...",
  "account_id": "...",
  "name": "...",
  "slug": "...",
  "timezone": "America/Lima",
  "roles": ["location_manager"],
  "access_source": "location_role"
}
```

For Account Admin implicit Location access, `access_source` is `account_role` and `roles` includes `account_admin`.

### Slice 2 Handoff

- Prefer extracting reusable authorization helpers from `AccessContextService` behavior rather than re-implementing access queries in controllers.
- Account Admin should be treated as having implicit access to all active Locations in the Active Account.
- Location Manager and Front Desk require explicit `location_user_roles` rows.
- `assigned_locations` is no longer the contract term; use `accessible_locations`.
- Active Location is a default/preference only. Location-scoped routes and mutations should still include the concrete Location and authorize it directly.
- The existing `LocationPolicy` should move toward the same helper semantics used by `AccessContextService`.
- Staff management in Slice 3 should use these helpers to ensure Account Admin role checks are Active Account aware but still server-authoritative.

### Tests

- Backend coverage lives in `MeApiTest` and `AccessContextApiTest`.
- Verified one-account auto-selection, multi-account selection requirement, stale context cleanup, context mutation responses, invalid context status codes, Account Admin implicit Location access, and explicit Location access for Location Manager / Front Desk.
- Frontend auth types and dashboard tests have been updated to consume `active_location` and `accessible_locations`.

## Slice 2: Authorization Helpers

Centralize common checks before adding more controllers.

Slice 2 is backend-only except for documentation or contract naming fixes. Frontend account selection, location switching, route guards, and role-aware navigation belong to Slices 5 and 6.

Extract a shared backend authorization service for Account and Location access semantics. Policies, context endpoints, and future staff-management controllers should call this service instead of repeating role queries.

Suggested service methods:

- `hasAccountRole(User $user, Account $account, AccountRole $role): bool`
- `hasLocationRole(User $user, Location $location, LocationRole $role): bool`
- `canAccessAccount(User $user, Account $account): bool`
- `canAccessLocation(User $user, Location $location): bool`
- `canManageStaff(User $user, Account $account): bool`
- `accessibleLocationsForAccount(User $user, Account $account)`

Avoid putting the canonical authorization logic directly on `User`. Thin model convenience methods can be added later only when they improve call sites without duplicating behavior.

Canonical authorization service methods should accept resolved model instances, not ULID strings. Controllers, route model binding, and request validation own lookup and not-found behavior.

`accessibleLocationsForAccount` should return an Eloquent query builder so callers can add filtering, pagination, ordering, existence checks, or materialization. `/api/me` can order by name and materialize the query when building the access-context payload.

`canAccessLocation` is intentionally broad. It answers whether the User can operate in or view the Location at all, including Account Admin implicit access and any explicit Location role. Narrower abilities such as managing staff, managing registry records, or using Front Desk workflows should be expressed as separate service methods or policy methods.

`hasLocationRole` should mean an explicit `location_user_roles` assignment only. Account Admin implicit Location access should not be reported as a Location Manager or Front Desk role.

`canManageStaff` should require an explicit Account Admin role for the target Account. Location Manager and Front Desk roles do not grant staff invitation or role-assignment authority.

Authorization helpers should not read Active Account or Active Location from the session. They should authorize from explicit Account and Location model arguments. `canAccessLocation` should accept the concrete Location and derive its Account from `location.account_id`; callers that need to enforce "inside the Active Account" should validate that separately before calling the helper. Session-backed context remains the responsibility of `AccessContextService` and context-aware controllers.

Operational access helpers should exclude soft-deleted Accounts, Locations, and role assignments. Account Admin implicit Location access applies only to non-deleted Locations returned by normal Eloquent scopes. If a future Location status field is added, inactive Location visibility should be handled by a separate settings/admin ability instead of the default operational access helper.

User deactivation should remain enforced by authentication or middleware boundaries such as `EnsureUserIsActive`. The scoped authorization service should not duplicate inactive-user checks in every helper.

Add an `AccountPolicy` in Slice 2 so Slice 3 staff endpoints can use Laravel authorization immediately. `view` should mean broad Account visibility from either an Account role or a Location role in that Account. `manageStaff` should require explicit Account Admin for the Account.

Keep one explicit Location role per User per Location in M2. The existing `(location_id, user_id)` uniqueness constraint should remain, and staff role assignment APIs should replace the Location role for that Location rather than append multiple roles.

A User may hold an Account Admin role and explicit Location roles in the same Account. Account Admin grants implicit access, while explicit Location roles still represent real staff assignments and should remain visible as explicit roles.

Keep Laravel policies authoritative. Frontend guards should only improve UX.

### Slice 2 Acceptance Tests

- Account Admin can access any non-deleted Location in their Account through `canAccessLocation`.
- Location Manager and Front Desk can access only explicitly assigned Locations.
- `hasLocationRole` is false for Account Admin implicit Location access without an explicit Location role.
- `canManageStaff` is true only for explicit Account Admin.
- `AccountPolicy::view` allows Account Admin and Users with a Location role in the Account.
- `AccountPolicy::manageStaff` denies Location Manager and Front Desk.
- `LocationPolicy::view` delegates to the shared helper semantics and existing dashboard tests still pass.

## Slice 3: Staff Invitation and Assignment API

### Minimal Data Model

Add a staff invitation foundation that can later be reused by resident invitations:

- `user_invitations`
  - `id`
  - `account_id`
  - nullable `location_id`
  - `email`
  - `first_name`
  - `last_name`
  - `token_hash`
  - `purpose`
  - `status`
  - `expires_at`
  - `accepted_at`
  - `invited_by_user_id`
  - timestamps

For M2, the invitation can create or prepare a user without requiring full email delivery. The important part is the workflow boundary and token-ready model.

### API

Account Admin endpoints:

- `GET /api/accounts/{account}/staff`
- `POST /api/accounts/{account}/staff/invitations`
- `PATCH /api/accounts/{account}/staff/{user}/roles`
- `PATCH /api/accounts/{account}/staff/{user}/locations`

Rules:

- Only Account Admin can invite staff users in v1.
- Account Admin can assign Account Admin, Location Manager, and Front Desk roles.
- Location Manager cannot create staff or change staff roles.
- Location-scoped roles must reference locations inside the account.

### Tests

- Account Admin can invite a staff user.
- Location Manager cannot invite staff.
- Account Admin can assign Front Desk to one location.
- Account Admin can assign Location Manager to multiple locations.
- Role assignment cannot cross account boundaries.

## Slice 4: Activity Logging Foundation

Add a custom activity log service now and prove it with role changes.

Suggested table:

- `activity_logs`
  - `id`
  - `account_id`
  - nullable `location_id`
  - `actor_user_id`
  - nullable `subject_type`
  - nullable `subject_id`
  - `event_type`
  - `summary`
  - `metadata`
  - `created_at`

Suggested service:

- `ActivityLogger::log(...)`

First event types:

- `staff.invited`
- `staff.role_assigned`
- `staff.role_removed`
- `staff.locations_changed`

Tests:

- Staff invite creates an activity log row.
- Role change creates an activity log row.
- Activity log account and location scope are correct.

## Slice 5: Frontend Account and Location Context

### Account Selection

Add a route such as `/select-account`.

Routing rules:

- Guest goes to `/login`.
- Authenticated user with one accessible account enters their default route directly.
- Authenticated user with multiple accounts and no active account goes to `/select-account`.
- Selecting an account calls `POST /api/context/account`, invalidates `/api/me`, then routes to the default surface.

### Location Switcher

Replace the placeholder location switcher with a real context mutation:

- Show locations available inside the active account.
- Switching location calls `POST /api/context/location`.
- Invalidate `/api/me` and location-scoped queries.
- Keep the visible selected location from server-returned context.

## Slice 6: Role-Aware Routes and Navigation

Add frontend access helpers:

- `canAccessAdmin`
- `canAccessFrontDesk`
- `canAccessPortal`
- `requiresAccountSelection`
- `getDefaultAuthenticatedRoute`
- `getAvailableNavigationItems`

Route behavior:

- Account Admin and Location Manager can access `/admin`.
- Front Desk can access `/front-desk`.
- Front Desk-only users cannot access `/admin`.
- Portal remains a guarded placeholder until resident memberships are implemented.

Navigation behavior:

- Account Admin sees account/staff/location management entries.
- Location Manager sees operational entries for assigned locations.
- Front Desk sees only front-desk workflows.
- Navigation must be derived from `/api/me`, not hard-coded per shell.

## Slice 7: Acceptance and Seed Scenarios

Add seed data for:

- Account Admin with one account.
- Location Manager assigned to one location.
- Front Desk assigned to one location.
- User with access to two accounts.

Final M2 acceptance checks:

- Account Admin can invite staff users.
- Account Admin can assign staff roles and locations.
- Location Manager only sees assigned locations.
- Front Desk user only sees front-desk routes for assigned locations.
- Navigation is derived from access context.
- Users with multiple accounts must select an active account before entering dashboard routes.
- Users with one account can enter the dashboard directly.
- Role changes are activity-logged.

## Suggested Pull Request Breakdown

1. Backend access context endpoints and `/api/me` contract tests.
2. Authorization helper methods and policy coverage.
3. Staff invitation and assignment API.
4. Activity logging table and service.
5. Account selection and location switcher UI.
6. Route guards and role-aware navigation.
7. M2 seed scenarios, regression tests, and documentation updates.

## Definition of Done

M2 is done when the product can correctly answer these questions from the backend access context:

- Which accounts can this user access?
- Which account is currently active?
- Which locations can this user access inside that account?
- Which location is currently active?
- Which product surface should this user enter?
- Which navigation items should this user see?
- Who changed a staff user's role or location assignment, and when?
