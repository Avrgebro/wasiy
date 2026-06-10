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

### Backend

- Add explicit session-backed context endpoints:
  - `POST /api/context/account`
  - `POST /api/context/location`
  - optional `DELETE /api/context`
- Validate that the selected account is accessible to the authenticated user.
- Validate that the selected location belongs to the active account and is accessible to the authenticated user.
- Update `/api/me` to return:
  - all accessible accounts
  - `active_account`
  - active location, if selected
  - account roles
  - location roles
  - assigned locations filtered by active account when applicable
  - resident memberships placeholder

### Tests

- One-account user can enter dashboard without selecting an account.
- Multi-account user without active account receives enough context for account selection.
- Multi-account user can select an accessible account.
- User cannot select an inaccessible account.
- User cannot select a location outside the active account.
- User cannot select an unassigned location unless they are Account Admin for that account.

## Slice 2: Authorization Helpers

Centralize common checks before adding more controllers.

Suggested helpers:

- `User::hasAccountRole(Account|string $account, AccountRole $role): bool`
- `User::hasLocationRole(Location|string $location, LocationRole $role): bool`
- `User::canAccessAccount(Account|string $account): bool`
- `User::canAccessLocation(Location|string $location): bool`
- `User::assignedLocationsForAccount(Account|string $account)`

Keep Laravel policies authoritative. Frontend guards should only improve UX.

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
