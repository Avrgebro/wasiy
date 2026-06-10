# Wasiy Technical Requirements Document

## Overview

Wasiy will be built as a multi-tenant SaaS product with a Laravel REST API and a separate Vite React SPA. The technical design prioritizes clear tenant boundaries, strong authorization, fast dashboard workflows, maintainable frontend state, and straightforward deployment.

This TRD supports the v1 PRD scope: account/location management, roles, resident and unit registry, CSV import, vehicles, visitor pre-registration and check-in, amenity reservations, manual reservation fee/deposit tracking, announcements, activity logging, exports, and operational dashboards.

## Architecture

Wasiy will use a modular monolith backend and a separate SPA frontend inside one monorepo.

```txt
wasiy/
  apps/
    api/        # Laravel REST API
    web/        # Vite React SPA
    marketing/  # Astro marketing site
  packages/
    contracts/  # TypeScript contracts, schemas, and frontend-facing shared types
  docs/
    adr/
```

The backend remains one deployable Laravel application with one PostgreSQL database. Product areas should be internally modular, but they should not be split into microservices for v1.

## Technology Stack

### Backend

- Laravel
- PHP
- PostgreSQL
- Redis
- Laravel Horizon
- Laravel Sanctum
- Laravel API Resources
- Laravel Queues
- Laravel Sail for local development
- Pest
- Laravel Pint
- Larastan/PHPStan

### Frontend

- Vite
- React
- TypeScript
- TanStack Router
- TanStack Query
- TanStack Table
- i18next / react-i18next
- React Hook Form
- Zod
- Mantine components
- @mantine/modals
- @mantine/dropzone
- Tailwind CSS for layout
- solar-react icons
- Vitest
- React Testing Library
- Playwright

### Infrastructure

- Vercel for `apps/web`
- Vercel for `apps/marketing`
- Laravel Forge for `apps/api`
- PostgreSQL
- Redis
- S3-compatible object storage
- Transactional email provider
- GitHub Actions

## Monorepo Requirements

The repository will use pnpm workspaces for JavaScript and TypeScript packages. Composer remains scoped to the Laravel application in `apps/api`.

Required workspace files:

```txt
package.json
pnpm-workspace.yaml
apps/web/package.json
apps/marketing/package.json
packages/contracts/package.json
apps/api/composer.json
```

Initial shared package:

```txt
packages/contracts
```

The contracts package should start narrow. It may contain TypeScript types, Zod schemas, and frontend-facing constants for request/response shapes. It should not become a general utility or UI package.

OpenAPI is deferred until the API stabilizes or mobile/external clients require generated contracts.

## Backend Design

### API Style

The backend will expose a REST API. GraphQL is out of scope for v1.

Laravel API Resources should define response payloads. The frontend should rely on Laravel's native response conventions:

- Single resources use `data`.
- Paginated collections use `data`, `links`, and `meta`.
- Validation errors use Laravel's default `message` and `errors`.
- General errors use Laravel's default `message`.

No custom global response wrapper should be introduced in v1.

### Backend Organization

The Laravel app should stay close to normal Laravel conventions while using action classes for meaningful workflows.

Suggested structure:

```txt
apps/api/app/
  Actions/
    Visitors/
    Reservations/
    Residents/
    Imports/
    Exports/
  Http/
    Controllers/
    Requests/
    Resources/
  Jobs/
  Mail/
  Models/
  Policies/
  Services/
```

Use:

- Form Requests for validation.
- API Resources for responses.
- Policies and Gates for authorization.
- Actions for workflow operations.
- Jobs for background work.
- Eloquent directly for persistence.

Avoid repository abstractions and heavy module frameworks in v1 unless concrete complexity justifies them.

## Frontend Design

### Application Structure

The React app should be feature-first, with route files composing feature modules.

Suggested structure:

```txt
apps/web/src/
  app/
    api-client.ts
    query-client.ts
    router.tsx
  routes/
    admin/
    front-desk/
    portal/
  features/
    accounts/
    locations/
    residents/
    units/
    vehicles/
    visitors/
    amenities/
    reservations/
    announcements/
    activity/
    exports/
  components/
    layout/
    ui/
  lib/
    dates.ts
    errors.ts
```

Rules:

- Routes should stay thin.
- Feature folders own their API wrappers, query hooks, schemas, pages, and feature components.
- Shared UI belongs in `components/ui`.
- Shared shells and navigation belong in `components/layout`.
- Auth bootstrap and API client behavior belong in central app/lib modules.

### UI System

Mantine should be used for interactive components such as:

- Inputs
- Selects
- Modals
- Drawers
- Menus
- Tabs
- Notifications
- Date controls
- Form-adjacent components
- Global confirmation modals
- File dropzones for amenity photos and CSV imports

Layout should use semantic HTML and Tailwind CSS classes. Avoid Mantine layout primitives such as `Grid`, `Box`, and `Stack` so the styling boundary stays clear.

Use `solar-react` for icons.

Use `@mantine/modals` for global confirmations and simple context modal flows. Complex forms should use explicit Wasiy `ModalForm` or `DrawerForm` wrappers.

Use `@mantine/dropzone` for amenity photo uploads and CSV import uploads. Frontend dropzone validation improves user experience, but Laravel remains authoritative for file validation.

### Internationalization

The v1 user interface should be Spanish-first, while the frontend should be implemented with future English support in mind.

Requirements:

- Use i18next with react-i18next for frontend UI translations.
- Keep user-facing strings in locale files instead of hard-coding copy inside components.
- Start with `es` as the default and only complete required v1 copy in Spanish.
- Structure translation keys so `en` can be added later without changing component logic.
- Use locale-aware date, time, and number formatting.
- Avoid storing translated labels as business state when stable enum/status values should be stored instead.

Suggested structure:

```txt
apps/web/src/
  i18n/
    index.ts
    locales/
      es/
        common.json
        auth.json
        residents.json
        visitors.json
        reservations.json
        amenities.json
        announcements.json
      en/
        common.json
```

Backend-generated user-facing messages, validation messages, and email templates should also be prepared for localization through Laravel's localization system, with Spanish as the initial complete locale.

### Email Template Strategy

Use Laravel Mailables and Blade templates for initial transactional emails. Do not add a dedicated email build pipeline during the tracer bullet or early scaffolding.

Maizzle is a good candidate for later branded transactional email templates because it is designed for HTML email development with a Tailwind-style workflow. If Maizzle is added in the email milestone, it should compile templates into Laravel-consumable Blade views without manual copy/paste.

Recommended Maizzle approach:

```txt
Maizzle source template
  -> Maizzle build
  -> placeholder post-processing
  -> generated Laravel Blade template
  -> Laravel Mailable renders with data
```

Do not rely on raw Blade variables inside Maizzle templates as the primary strategy. Use placeholder tokens in Maizzle source and replace them with Blade variables in a post-build step.

Example Maizzle source:

```html
<p>Hola, @@residentName@@</p>
<a href="@@inviteUrl@@">Activar mi cuenta</a>
```

Example placeholder map:

```json
{
  "resident-invitation": {
    "@@residentName@@": "{{ $residentName }}",
    "@@inviteUrl@@": "{{ $inviteUrl }}"
  }
}
```

Generated Blade output:

```blade
<p>Hola, {{ $residentName }}</p>
<a href="{{ $inviteUrl }}">Activar mi cuenta</a>
```

This keeps Maizzle templates tool-friendly and keeps Laravel data binding explicit.

### Forms

Frontend forms should use React Hook Form and Zod. Laravel validation remains authoritative.

Frontend validation should provide fast user feedback, but server validation errors must always be handled and displayed.

### Tables

Operational list screens must use server-side pagination, filtering, and sorting.

Frontend responsibilities:

- TanStack Table manages table state.
- TanStack Router keeps pagination/filter/sort state in the URL.
- TanStack Query fetches results from the API.

Backend endpoints should accept common query parameters such as:

```txt
page
per_page
sort
direction
search
status
date_from
date_to
location_id
```

## Authentication

The SPA will use Laravel Sanctum cookie-based authentication.

Expected deployment shape:

```txt
app.wasiyapp.com
api.wasiyapp.com
```

Requirements:

- Use Sanctum stateful SPA authentication.
- Use secure cookies and CSRF protection.
- Do not store browser auth tokens in localStorage.
- Laravel owns users, roles, location assignments, resident memberships, and permissions.

The frontend should bootstrap auth state from:

```txt
GET /api/me
```

`/api/me` should return the current user, account, assigned locations, roles, resident unit memberships, and any access context needed to render navigation.

Frontend route guards and menus are UX aids only. Laravel policies remain authoritative.

Users may have access to multiple Accounts. If `/api/me` returns more than one accessible Account and no active Account has been selected, the frontend should route the user to an account selection page before rendering account-scoped dashboard routes.

Recommended flow:

```txt
Login
  -> one accessible Account: enter dashboard directly
  -> multiple accessible Accounts: show account selection page
  -> active Account selected: enter dashboard
  -> active Location selected/switched inside dashboard when needed
```

The active Account is a UX context, not a security boundary by itself. Backend policies and query scoping must still validate the authenticated user's access to the requested Account and Location on every protected request.

## Authorization

Authorization must be custom and domain-scoped.

V1 roles:

- Account Admin
- Location Manager
- Front Desk / Security
- Resident

Required authorization model:

- Account Admin role is account-scoped.
- Location Manager role is location-scoped.
- Front Desk / Security role is location-scoped.
- Resident permissions come from Unit Memberships, not staff role assignments.
- A User may have role assignments in more than one Account.
- A Location Manager may manage multiple Locations in the same Account or in different Accounts.

Use Laravel Policies and Gates for access checks. Avoid hard-coded controller role checks and avoid generic permission packages in v1.

Every protected backend action must verify access server-side.

## Multi-Tenancy

Wasiy will use a single PostgreSQL database with shared tables and explicit account scoping.

Rules:

- Every tenant-owned table must include `account_id`.
- Location-scoped tables must include `location_id`.
- Backend queries and policies must enforce account/location boundaries.
- Frontend filtering is not a security mechanism.
- Common indexes should include `account_id`, `location_id`, status fields, and date fields used in tables.

Representative ownership:

```txt
locations: account_id
units: account_id, location_id
residents: account_id
unit_memberships: account_id, location_id, unit_id, resident_id
vehicles: account_id, location_id, unit_id nullable, resident_id nullable
amenities: account_id, location_id
reservations: account_id, location_id, amenity_id, unit_id
visitor_pre_registrations: account_id, location_id, unit_id, resident_id
visitor_check_ins: account_id, location_id, unit_id nullable, resident_id nullable
announcements: account_id, location_id nullable
activity_logs: account_id, location_id nullable
exports: account_id, location_id nullable
```

## Data Model Requirements

### IDs

Use ULIDs for primary keys on product/domain records.

Benefits:

- Safe to expose in URLs and API responses.
- Do not leak sequential record counts.
- Can be generated application-side.
- Roughly sortable by creation time.

### Dates and Time Zones

Store timestamps in UTC. Each Location must define an IANA time zone.

Scheduling workflows should interpret local user input in the Location's time zone, then persist UTC timestamps.

Visitor check-in timestamps should be recorded server-side in UTC and displayed in the Location's time zone.

### Deletion

Locations support two lifecycle actions:

- Archive: reversible removal from normal operational use without deleting child records.
- Delete permanently: explicit destructive removal that may hard-delete Location-owned operational records.

Activity logs should be append-only and should not cascade delete with operational records. Activity log entries must store enough snapshot data, such as actor label, location label, subject label, event type, summary, metadata, and timestamp, to remain understandable after related records are deleted.

### Visitor Retention

Visitor check-in logs have a default 12-month retention period in v1. Visitor ID images and visitor photos are out of scope for v1.

Future versions may add Account or Location configurable retention.

## Core Technical Workflows

### CSV Import

CSV imports for units, residents, and related registry data must use a queued validation preview flow.

Flow:

1. Manager uploads CSV.
2. API stores the file and creates an import record.
3. Queue parses and validates rows.
4. Manager reviews valid rows, errors, duplicates, and warnings.
5. Manager confirms import.
6. Queue writes records.
7. Activity log records completion.

CSV import should not write records directly before validation preview.

### CSV Export

Exports should be queued and stored on S3-compatible storage.

Flow:

1. User requests export with filters.
2. API creates export record.
3. Queue generates CSV.
4. File is stored on S3-compatible storage.
5. User sees pending, processing, ready, or failed status.
6. Ready exports expose a downloadable URL.
7. Export files expire after a configured retention period.

### Amenity Photo Upload

Amenity photos should be uploaded through the Laravel API.

Flow:

1. Frontend submits `multipart/form-data`.
2. Laravel validates file type and size.
3. Laravel stores the file on S3-compatible storage.
4. Database stores object path and metadata.
5. API returns photo metadata and display URL.

Direct browser-to-S3 uploads are deferred.

Suggested v1 constraints:

- JPEG, PNG, and WebP only.
- Maximum file size: 5 MB.
- Maximum photos per amenity: 10.

### Activity Logging

Activity logging should be custom and product-facing.

Suggested fields:

```txt
id
account_id
location_id nullable
actor_user_id nullable
subject_type nullable
subject_id nullable
event_type
summary
metadata jsonb
occurred_at
created_at
```

Workflow actions should call an activity logging service for meaningful product events, such as:

- User invited or role changed.
- Resident invited or deactivated.
- Unit Membership changed.
- Visitor pre-registration created or cancelled.
- Visitor check-in recorded.
- Reservation created, approved, rejected, or cancelled.
- Amenity settings changed.
- Announcement posted.
- Reservation fee/deposit status changed.

## Background Jobs

Use Laravel queues backed by Redis and monitored through Laravel Horizon across environments.

Queued work includes:

- Invitation emails
- Reservation decision emails
- Optional announcement emails
- CSV import parsing/validation/commit
- CSV export generation
- Future image processing

Horizon should be supervised in deployed environments.

## Local Development

Backend local development should use Laravel Sail with:

- PostgreSQL
- Redis
- Mailpit
- MinIO

Frontend local development should run separately with pnpm and Vite.

Typical local processes:

```txt
apps/api: Laravel Sail
apps/web: pnpm dev
```

Local development should exercise Redis, Horizon, Mailpit, and MinIO so the team does not discover queue, email, or object-storage bugs only after deployment.

## Deployment

### Frontend

Deploy `apps/web` to Vercel.

Vercel settings:

```txt
Root Directory: apps/web
Build Command: pnpm build
Output Directory: dist
```

### Marketing Site

Deploy `apps/marketing` to Vercel.

Recommended stack:

- Astro.
- Tailwind CSS.
- Shared color direction from the app design system.

Recommended domain:

```txt
root domain / www domain -> apps/marketing
app subdomain -> apps/web
api subdomain -> apps/api
```

The marketing site should stay separate from the authenticated SPA and should not use Mantine unless a specific need appears.

### Backend

Deploy `apps/api` to Laravel Forge.

Forge should run a deploy script that changes into `apps/api`, installs Composer dependencies, runs migrations, caches config/routes, and restarts queues.

Conceptual deploy steps:

```bash
cd apps/api
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan queue:restart
```

Horizon should be configured as a supervised process.

### Environments

Production should prefer managed services for:

- PostgreSQL
- Redis
- Object storage
- Transactional email

Staging may self-host PostgreSQL on the same Forge server to reduce early infrastructure overhead.

## CI and Quality Gates

Use GitHub Actions for pull request checks.

Backend checks:

- Composer install
- Laravel Pint
- Larastan/PHPStan
- Pest

Frontend checks:

- pnpm install
- TypeScript check
- ESLint
- Vitest
- Production build

Playwright should be added for critical end-to-end flows as they stabilize.

## Testing Requirements

### Backend

Use Pest for Laravel tests.

Prioritize:

- Multi-tenant scoping
- Authorization policies
- Account/location role behavior
- Resident Unit Membership behavior
- Visitor pre-registration and check-in
- Reservation approval rules
- CSV import validation
- Activity logging

### Frontend

Use Vitest and React Testing Library for component and feature logic.

Prioritize:

- Forms
- Validation error display
- Route protection
- Table filter/pagination state
- Query invalidation after mutations

### End-to-End

Use Playwright for critical user journeys:

- Account Admin logs in and creates a location/user.
- Manager imports units/residents.
- Resident accepts invite.
- Resident pre-registers visitor.
- Front Desk records visitor check-in.
- Resident creates reservation.
- Manager approves reservation.
- Manager posts announcement.

## Security Requirements

- Enforce authorization server-side with policies.
- Never rely on frontend route guards for security.
- Use secure cookie auth through Sanctum.
- Use CSRF protection for SPA auth requests.
- Do not store auth tokens in localStorage.
- Validate all file uploads server-side.
- Avoid visitor ID image/photo uploads in v1.
- Ensure every tenant-owned query is account/location scoped.
- Log sensitive operational actions through the activity log.

## Performance Requirements

V1 performance should focus on operational responsiveness:

- Table endpoints must paginate server-side.
- Search/filter endpoints should be indexed around account, location, status, and dates.
- Long-running work must use queues.
- CSV imports and exports must not block request/response cycles.
- Frontend should use TanStack Query caching and invalidation instead of global ad hoc state.

## Open Technical Questions

- Which transactional email provider should be used?
- Which S3-compatible storage provider should be used?
- What exact CSV templates should be supported for import?
- Should CSV imports support flexible column mapping in v1?
- What export file expiration period should be used?
- What exact visitor retention cleanup mechanism should run?
- Should production PostgreSQL and Redis be managed from day one?
- Should staging use a separate Vercel project or preview deployments only?
- Should the API include rate limiting for login, invites, and visitor workflows?
- Should resident invitation links expire, and after how long?
- Should reservation cancellation windows be implemented in v1?
- Which Spanish regional variant should be treated as the default product voice?

## Decision Records

This TRD is backed by the ADRs in `docs/adr/`, especially:

- `0001-multi-tenant-saas-from-day-one.md`
- `0002-monorepo-with-separate-api-and-web-apps.md`
- `0003-pnpm-workspaces-with-contracts-package.md`
- `0004-lightweight-contracts-before-openapi.md`
- `0005-sanctum-cookie-auth-for-spa.md`
- `0006-custom-scoped-authorization.md`
- `0007-shared-database-account-scoped-tenancy.md`
- `0008-rest-api-for-v1.md`
- `0009-react-hook-form-and-zod.md`
- `0010-mantine-components-tailwind-layout.md`
- `0011-server-side-table-state.md`
- `0012-laravel-api-resource-responses.md`
- `0013-laravel-handled-s3-uploads.md`
- `0014-redis-queues-with-horizon.md`
- `0015-sail-local-development-stack.md`
- `0016-testing-stack.md`
- `0017-vercel-web-forge-api-deployment.md`
- `0018-github-actions-quality-gates.md`
- `0019-laravel-conventions-with-actions.md`
- `0020-feature-first-react-structure.md`
- `0021-utc-storage-location-time-zones.md`
- `0022-ulids-for-domain-records.md`
- `0023-soft-deletes-append-only-activity.md`
- `0024-visitor-log-retention-default.md`
- `0025-custom-product-activity-log.md`
- `0026-csv-import-validation-preview.md`
- `0027-queued-expiring-csv-exports.md`
- `0028-api-me-permission-bootstrap.md`
- `0029-spanish-first-localization-ready.md`
- `0030-active-account-selection-for-multi-account-users.md`
