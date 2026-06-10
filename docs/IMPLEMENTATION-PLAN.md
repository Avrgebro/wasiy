# Wasiy V1 Implementation Plan

## Overview

This plan turns the PRD, TRD, and design system into a build sequence for v1. The goal is to ship the smallest coherent product that validates the architecture and supports the core operational workflows: account/location management, roles, resident/unit registry, vehicles, visitors, amenities, reservations, announcements, activity logs, exports, and Spanish-first UI.

Implementation should start with a tracer bullet, then grow through vertical slices. Avoid building broad infrastructure or database models without proving them through real user-facing workflows.

## Delivery Principles

- Build vertical slices, not isolated layers.
- Keep the backend as a modular monolith.
- Keep one PostgreSQL database with strict `account_id` and `location_id` scoping.
- Enforce authorization in Laravel policies, not only the frontend.
- Use Spanish UI copy from the beginning.
- Use semantic design tokens, Mantine component primitives, and Tailwind layout.
- Add tests around tenant scoping, roles, and core workflows as features land.
- Prefer useful operational screens over analytics-heavy dashboards.

## Milestones

## M0: Monorepo and Local Development Scaffold

Status: Completed.

Verification note: scaffold, dependencies, root scripts, frontend build, API tests, Laravel health route, and Sail service configuration are present. Sail runtime startup still requires Docker or Podman to be running locally.

Goal: create the project foundation and make local development reproducible.

Scope:

- Create monorepo structure:
  ```txt
  apps/api
  apps/web
  packages/contracts
  ```
- Configure pnpm workspaces.
- Scaffold Laravel API in `apps/api`.
- Scaffold Vite React TypeScript app in `apps/web`.
- Configure Laravel Sail with PostgreSQL, Redis, Mailpit, and MinIO.
- Configure frontend dependencies:
  - Mantine
  - Tailwind CSS
  - TanStack Router
  - TanStack Query
  - TanStack Table
  - React Hook Form
  - Zod
  - i18next / react-i18next
  - solar-react
  - @mantine/modals
  - @mantine/dropzone
- Add base design tokens and Mantine theme adapter.
- Add Mantine provider stack, including modals and notifications.
- Add Spanish i18n bootstrap.
- Add root scripts for common frontend/backend commands where practical.

Acceptance criteria:

- Backend runs locally through Sail.
- Frontend runs locally through pnpm/Vite.
- PostgreSQL, Redis, Mailpit, and MinIO are available locally.
- A basic frontend page renders using Wasiy tokens and Mantine.
- A basic Laravel health endpoint responds.

## M1: Tracer Bullet

Status: Completed.

Goal: prove the architecture end to end with production-shaped code.

Tracer bullet:

> A Location Manager logs in and sees a protected dashboard shell with real data for their assigned Location.

Scope:

- Implement initial database tables:
  - accounts
  - locations
  - users
  - account role assignments
  - location role assignments
- Use ULIDs for domain records.
- Configure Sanctum cookie-based SPA auth.
- Implement login/logout.
- Implement `/api/me`.
- Seed one Account, one Location, and one Location Manager user.
- Implement location-scoped authorization policy checks.
- Build protected frontend route.
- Build Location Manager dashboard shell using design-system tokens.
- Fetch `/api/me` with TanStack Query.
- Show location name and one real metric from API.
- Add one backend feature test for protected access.
- Add one frontend smoke/component test for protected dashboard rendering.

Acceptance criteria:

- Authenticated Location Manager can access their dashboard.
- Unauthenticated user cannot access protected API or route.
- User without location assignment receives `403` for location data.
- Frontend renders Spanish copy from i18n files.
- CI can run initial backend and frontend checks.

Note: the tracer bullet may use a single Account, but the auth and `/api/me` shape should not assume a User can only access one Account.

## M2: Account, Location, Roles, and Navigation Foundation

Goal: establish the permission and navigation model needed by all later workflows.

Scope:

- Account Admin role.
- Location Manager role.
- Front Desk / Security role.
- Resident portal access model placeholder.
- User invitation foundation for staff.
- Location assignment management.
- `/api/me` returns:
  - user
  - accessible accounts
  - active account context when selected
  - roles
  - accessible locations
  - resident memberships placeholder
- Account selection page for Users with access to multiple Accounts.
- Location switcher for Users with access to multiple Locations inside the active Account.
- Frontend route groups:
  - admin
  - front-desk
  - portal
- Role-aware navigation.
- Activity logging service foundation.

Acceptance criteria:

- Account Admin can invite staff users.
- Account Admin can assign staff roles and locations.
- Location Manager only sees assigned locations.
- Front Desk user only sees front-desk routes for assigned locations.
- Navigation is derived from access context.
- Users with multiple Accounts must select an active Account before entering dashboard routes.
- Users with one Account can enter the dashboard directly.
- Role changes are activity-logged.

## M3: Units, Residents, Unit Memberships, and Vehicles

Goal: build the registry foundation for visitors, reservations, and resident portal access.

Scope:

- Units CRUD.
- Residents CRUD.
- Unit Membership model:
  - resident type
  - active/inactive status
  - primary contact flag
  - support one resident across multiple units
- Resident invitation and claim-account flow.
- Vehicle CRUD for managers.
- Resident self-service vehicle management.
- Registry list pages with server-side table state.
- CSV export for units/residents and vehicles.
- Activity log entries for key registry changes.

Acceptance criteria:

- Manager can create and edit units.
- Manager can create residents and assign them to units.
- A unit can have one primary contact.
- A resident can belong to multiple units.
- Resident can claim portal access.
- Resident can manage vehicles but cannot change unit membership or resident type.
- Managers can export registry and vehicle CSVs.
- Authorization tests cover location scoping.

## M4: CSV Import for Registry

Goal: make onboarding practical for real buildings.

Scope:

- CSV upload for units/residents.
- Queued validation job.
- Import record with statuses:
  - pending
  - processing
  - ready_for_review
  - failed
  - completed
- Validation preview UI:
  - valid rows
  - errors
  - duplicates
  - warnings
- Confirm import flow.
- Queued commit job.
- Activity log entry on completion.

Acceptance criteria:

- Manager can upload CSV and see validation preview before records are created.
- Invalid rows are clearly shown in Spanish.
- Confirmed import creates units/residents/memberships.
- Import cannot create records across unauthorized locations.
- Import failure is recoverable and visible.

## M5: Visitor Management and Front Desk Interface

Goal: support daily visitor operations without in-app approval workflow.

Scope:

- Visitor pre-registration by Resident for a single date.
- Walk-in visitor check-in by Front Desk / Security.
- Visitor check-in record:
  - visitor name
  - optional phone
  - optional ID/reference text
  - host Resident or Unit
  - location
  - visit date / expected time
  - confirmation method
  - notes
  - checked-in timestamp
  - actor user
- Front Desk dashboard:
  - big search
  - expected visitors today
  - recent check-ins
  - quick check-in drawer
- Visitor check-in export by date range.
- 12-month visitor retention job placeholder or scheduled cleanup design.
- Activity logging.

Acceptance criteria:

- Resident can pre-register a visitor for their unit.
- Front Desk can find expected visitors for today.
- Front Desk can create walk-in check-in.
- Check-out is optional and not required.
- No in-app approval gate blocks check-in.
- Visitor records are location-scoped.
- Activity log records check-ins.

## M6: Amenities, Photos, and Reservations

Goal: support shared-space management and resident reservations.

Scope:

- Amenity CRUD.
- Amenity photo upload through Laravel to S3-compatible storage.
- Amenity configuration:
  - reservable yes/no
  - availability days/hours
  - instant booking or approval required
  - optional fee/deposit
  - active/inactive
- Resident reservation flow:
  - date picker
  - available slots
  - create reservation for Unit
- Manager reservation review:
  - approve
  - reject with required reason
  - cancel
- Manual fee/deposit status:
  - unpaid
  - paid
  - not required
- Reservation schedule views:
  - resident upcoming reservations
  - manager agenda/list
  - front-desk today schedule
- Reservation exports.
- Email notification for approval/rejection.
- Activity logging.

Acceptance criteria:

- Manager can create amenity with photos.
- Resident can request or instant-book a reservation depending on amenity policy.
- Reservation limits apply to Unit, not individual resident.
- Manager can approve/reject with reason.
- Resident sees reservation status.
- Manual fee/deposit status can be updated by manager.
- Reservation workflows are location- and unit-scoped.

## M7: Announcements and Email Notifications

Goal: provide simple communication without building a messaging platform.

Scope:

- Announcement CRUD.
- Location-targeted announcements.
- Resident Portal announcement list.
- Optional email for new announcement.
- Staff and resident invitation emails.
- Reservation approval/rejection emails.
- Spanish email templates.
- Evaluate Maizzle for branded email templates.
- If Maizzle is adopted, use placeholder tokens and a post-build step to generate Laravel Blade templates.
- Mailpit local testing.

Acceptance criteria:

- Manager can post announcement to a location.
- Residents assigned to that location can view it.
- Announcements do not support comments, threads, or read receipts.
- Email templates are Spanish-first.
- Email templates are either plain Laravel Blade or generated into Blade without manual copy/paste.
- Notifications are queued through Redis/Horizon.

## M8: Activity Log, Exports, and Operational Dashboards

Goal: complete operational visibility and admin reporting basics.

Scope:

- Product-facing activity log list.
- Activity log filters:
  - date range
  - actor
  - event type
  - location
- Queued CSV exports:
  - units/residents
  - vehicles
  - visitor check-ins
  - reservations
  - reservation fees/deposits
  - activity log
- Export status UI:
  - pending
  - processing
  - ready
  - failed
- Dashboard metrics:
  - visitor count today
  - pending reservations
  - unclaimed resident invitations
  - unit/resident counts
- Download-ready export links with expiration.

Acceptance criteria:

- Account Admin and Location Manager can view activity for permitted scope.
- Export generation does not block API request/response.
- Export files expire according to configured retention.
- Dashboards use real API data.

## M9: Polish, Accessibility, QA, and Deployment Readiness

Goal: make v1 stable enough for staging and initial customer feedback.

Scope:

- Accessibility pass:
  - keyboard navigation
  - focus states
  - field error associations
  - modal/drawer focus handling
  - status text not color-only
- Responsive pass:
  - desktop admin
  - tablet front desk
  - mobile resident portal
- Spanish copy pass.
- Empty/loading/error state pass.
- Playwright tests for critical workflows.
- GitHub Actions quality gates.
- Vercel deployment for web.
- Minimal Astro marketing site in `apps/marketing`.
- Vercel deployment for marketing site on the root domain.
- Forge deployment for API.
- Horizon supervisor config.
- Production/staging environment variable checklist.

Acceptance criteria:

- Core Playwright flows pass.
- CI passes backend and frontend checks.
- Staging deploy is functional.
- Root domain marketing site is live with basic product positioning, pricing/demo request information, and app login link.
- Frontend and backend environment configs are documented.
- Product is ready for first controlled user testing.

## Suggested First Tracer Bullet Tasks

Use these as the first implementation tasks after scaffolding:

1. Create monorepo structure and workspace files.
2. Scaffold Laravel API and Vite React app.
3. Configure Sail services.
4. Add Wasiy frontend tokens and Mantine theme.
5. Add Spanish i18n setup.
6. Add Sanctum auth.
7. Create Account, Location, User, and LocationRoleAssignment models.
8. Seed one Account, one Location, and one Location Manager.
9. Implement `/api/me`.
10. Implement one protected API metric endpoint.
11. Implement protected dashboard route.
12. Render Location Manager dashboard shell with real location data.
13. Add backend feature test for location-scoped access.
14. Add frontend smoke test.
15. Add initial GitHub Actions checks.

## V1 Not Included

Do not spend implementation time on these until v1 scope is stable:

- Full accounting.
- Online payments.
- Expense management.
- Maintenance requests.
- Documents.
- Packages.
- Incident logs.
- Recurring visitors.
- Visitor ID/photo uploads.
- Native mobile app.
- Push/SMS/WhatsApp notifications.
- Custom report builder.
- Dark mode.
- Final brand/logo.
- Microservices.
- Marketing blog, CMS, case studies, complex animations, newsletter automation, and payment checkout.

## Key Risks

### Permission Drift

Risk: frontend route guards and backend policies diverge.

Mitigation: backend policies are authoritative; `/api/me` only drives frontend UX.

### Tenant Leakage

Risk: queries miss `account_id` or `location_id` filters.

Mitigation: policy tests and feature tests for cross-account/cross-location access.

### Import Complexity

Risk: CSV import becomes a hidden data-quality problem.

Mitigation: validation preview before committing records.

### Reservation Rules Sprawl

Risk: amenity policies become too complex for v1.

Mitigation: support availability, approval required, and manual fees only; defer advanced rules.

### UI Over-Decoration

Risk: dashboard becomes card-heavy or marketing-like.

Mitigation: follow design-system density, table, and operational dashboard rules.

## Open Implementation Decisions

- Exact transactional email provider.
- Exact S3-compatible storage provider.
- CSV template format and whether flexible column mapping is v1.
- Export file expiration period.
- Visitor retention cleanup schedule.
- Production managed PostgreSQL/Redis provider.
- Default Spanish regional variant.
- Whether resident invitation links expire after 7, 14, or 30 days.
- Whether reservation cancellation windows are included in v1.
