# M3 Roadmap: Units, Residents, Unit Memberships, and Vehicles

## Goal

M3 builds the registry foundation that later visitor, reservation, announcement, and resident portal workflows depend on: residential Units, Residents, Unit Memberships, portal claim access, Vehicles, registry exports, and activity logging.

The main risk is treating registry records as simple CRUD. They are the future authorization and operational history backbone. Treat M3 as a scoped registry and portal-access milestone first, then add the minimum list pages and self-service UI needed to prove it.

## Current Starting Point

Already present from M2:

- Session-owned Active Account and Active Location context.
- `/api/me` returns user, active account, active location, accessible locations, roles, and an empty `resident_memberships` placeholder.
- `AccessAuthorizationService` centralizes Account and Location access semantics.
- Account Admin and Location Manager access to the admin surface.
- Portal route group exists but has no real Resident access model yet.
- Staff invitation model exists with token hashing, purpose, status, expiry, and actor fields.
- Activity logging table, model, service, enum, and staff events exist.
- Server-side paginated staff list establishes API response shape and query conventions.

Still missing for M3:

- Unit, Resident, Unit Membership, Vehicle, Export, and Resident Invitation data models.
- Resident access helpers based on active Unit Memberships.
- `/api/me` resident memberships payload.
- Manager registry APIs for Units, Residents, Memberships, and Vehicles.
- Resident invitation claim flow.
- Portal self-service for phone and Unit-owned Vehicles.
- Registry list pages with server-owned pagination/filter/sort state.
- Queued CSV export foundation and registry/vehicle export jobs.
- Activity log events for registry, resident invitation, portal claim, phone update, vehicle changes, and exports.

## Implementation Strategy

Build M3 in vertical slices, starting with the domain model and authorization contracts. Do not start with broad UI tables before the backend can answer who can manage which registry records and which portal capabilities a Resident has.

Recommended order:

1. Registry schema, enums, factories, and model relationships.
2. Registry authorization helpers and policies.
3. Manager Unit and Resident workflows.
4. Resident Invitation and claim-account flow.
5. `/api/me` resident memberships and Portal access.
6. Vehicle management for managers and Residents.
7. Registry list pages with server-side table state.
8. Queued CSV export foundation.
9. Activity logging and acceptance seed scenarios.

## Slice 1: Registry Domain Model

Add the registry tables and enums before controllers:

- `units`
- `residents`
- `unit_memberships`
- `vehicles`

### Canonical Model Decisions

- `residents` are Account-scoped only. A Resident's Location relationship comes through Unit Memberships.
- `units` are residential spaces only, not parking spots, storage lockers, or non-residential assets.
- `unit_memberships` link Residents to Units and carry resident type, status, and primary-contact state.
- `vehicles` belong to Units only in M3. They do not link directly to Residents.
- Portal access is opt-in per Resident through nullable `residents.user_id`.
- Resident permissions come from active Unit Memberships for Residents linked to the authenticated User.

### Suggested Tables

`units`:

- `id`
- `account_id`
- `location_id`
- `unit_number`
- nullable `building_name`
- nullable `floor`
- `status`
- nullable `notes`
- timestamps

`residents`:

- `id`
- `account_id`
- nullable `user_id`
- `first_name`
- `last_name`
- nullable `phone`
- nullable `email`
- `status`
- timestamps

`unit_memberships`:

- `id`
- `account_id`
- `location_id`
- `unit_id`
- `resident_id`
- `resident_type`
- `status`
- `is_primary_contact`
- nullable `started_at`
- nullable `ended_at`
- timestamps

`vehicles`:

- `id`
- `account_id`
- `location_id`
- `unit_id`
- `vehicle_type`
- nullable `plate`
- nullable `make`
- nullable `model`
- nullable `color`
- `status`
- nullable `notes`
- timestamps

### Enums

Resident types are fixed system values in M3:

- `owner`
- `tenant`
- `occupant`
- `guest_resident`

Registry statuses:

- `active`
- `inactive`

Vehicle types can start as fixed system values:

- `car`
- `motorcycle`
- `bicycle`
- `other`

Keep Spanish labels in frontend i18n files and API validation messages, not in persisted enum values.

### Constraints and Indexes

- Every registry-owned table includes `account_id`.
- Location-scoped registry tables include `location_id`.
- `units.location_id` must belong to the same Account as `units.account_id`.
- `unit_memberships.unit_id` and `unit_memberships.resident_id` must belong to the same Account.
- `unit_memberships.location_id` must match the Unit's Location.
- `vehicles.unit_id` must belong to the same Account and Location as the Vehicle.
- Units should be unique per Location by `unit_number` plus nullable `building_name`.
- A Resident may have multiple Unit Memberships.
- A Unit may have zero or one active Primary Contact.
- Only active Unit Memberships can be Primary Contact.
- `residents.user_id` should be unique when present.

For PostgreSQL, prefer partial unique indexes where the invariant is conditional:

- one active Primary Contact per Unit
- unique linked User per Resident

### Lifecycle Strategy

Use a hybrid delete/inactive strategy:

- Hard delete Units only when they have no memberships, vehicles, activity references, or future dependent records.
- Hard delete Residents only when they have no memberships, no portal link, no invitations, and no activity references.
- Unit Memberships normally become inactive instead of being hard-deleted.
- Vehicles can be hard-deleted in M3 when they have no meaningful history, but include `status` now for consistency.
- Records with meaningful operational history become inactive instead of being hard-deleted.

Do not cascade soft-delete future dependent records such as reservations when a Unit becomes inactive. The parent record remains as historical context.

### Tests

- A Resident can belong to multiple Units.
- A Unit cannot have more than one active Primary Contact.
- Inactive Unit Memberships cannot be Primary Contact.
- Setting a new Primary Contact clears the previous Primary Contact.
- Vehicle Unit, Location, and Account scope cannot drift.
- Resident `user_id` cannot be linked to multiple Residents.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added the registry domain foundation for Units, Residents, Unit Memberships, and Vehicles with enum casts, factories, model relationships, and PostgreSQL constraints for primary contact and scope invariants.
- Changed areas: `apps/api/database/migrations/2026_06_12_000001_create_registry_tables.php`, `apps/api/app/Enums`, `apps/api/app/Models`, `apps/api/database/factories`, `apps/api/tests/Feature/RegistryDomainModelTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/RegistryDomainModelTest.php` passed; `./vendor/bin/sail artisan test` passed with 77 tests and 458 assertions; `./vendor/bin/sail pint ...` ran and only formatted the new migration.
- Decisions: Used composite foreign keys to keep Account/Location/Unit scope aligned, partial unique indexes for nullable Resident portal links and active primary contacts, and `UnitMembership::markAsPrimaryContact()` for explicit primary-contact replacement.
- Follow-up: Slice 2 can build registry authorization helpers and policies on top of these models.

## Slice 2: Registry Authorization

Extend the backend authorization boundary before adding registry controllers.

Suggested `AccessAuthorizationService` additions:

- `canManageRegistry(User $user, Location $location): bool`
- `canViewRegistry(User $user, Location $location): bool`
- `canManageUnit(User $user, Unit $unit): bool`
- `canManageResidentInLocation(User $user, Resident $resident, Location $location): bool`
- `canManageVehicle(User $user, Vehicle $vehicle): bool`
- `residentForUser(User $user): ?Resident`
- `activeResidentMembershipsForUser(User $user)`
- `canResidentAccessUnit(User $user, Unit $unit): bool`
- `canResidentManageVehicle(User $user, Vehicle $vehicle): bool`

M3 permission rules:

- Account Admin can manage registry records across all Locations in the Active Account, but endpoints still authorize explicit route models.
- Location Manager can manage Units, Residents through memberships, Unit Memberships, and Vehicles only for accessible Locations.
- Front Desk can view lookup-oriented registry data later, but M3 manager CRUD should not grant Front Desk mutation authority.
- Resident portal access is based on linked Resident plus active Unit Memberships.
- Resident Users can update only their own phone number and Vehicles for active Units they belong to.
- Resident Users cannot change name, email, resident type, Unit Membership, Primary Contact status, or Unit assignment.

Add policies:

- `UnitPolicy`
- `ResidentPolicy`
- `UnitMembershipPolicy` if mutations are separated
- `VehiclePolicy`

Policies should delegate core scope checks to `AccessAuthorizationService`.

### Tests

- Account Admin can manage Units and Residents in any Location in the Account.
- Location Manager can manage only accessible Locations.
- Location Manager cannot create membership in an inaccessible Location.
- Front Desk cannot mutate registry records.
- Resident can access portal only when linked to an active Resident with active Unit Memberships.
- Resident cannot mutate membership fields or another Unit's Vehicles.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Extended `AccessAuthorizationService` with registry management, registry viewing, Resident portal membership, Unit, Resident, Membership, and Vehicle authorization helpers. Added registry policies that delegate scope decisions to the service.
- Changed areas: `apps/api/app/Services/AccessAuthorizationService.php`, `apps/api/app/Policies/UnitPolicy.php`, `ResidentPolicy.php`, `UnitMembershipPolicy.php`, `VehiclePolicy.php`, `apps/api/tests/Feature/AccessAuthorizationServiceTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/AccessAuthorizationServiceTest.php` passed; `./vendor/bin/sail artisan test` passed with 83 tests and 494 assertions; `./vendor/bin/sail pint ...` ran and only formatted `VehiclePolicy.php`.
- Decisions: `canViewRegistry` includes Front Desk for lookup-oriented registry visibility, while `canManageRegistry` is limited to Account Admin and Location Manager. Resident portal vehicle permissions are based on active linked Resident memberships for active Units.
- Follow-up: Slice 3 can use `UnitPolicy::create($location)`, Unit `view/update/delete`, and `canManageRegistry` to implement Manager Unit CRUD.

## Slice 3: Manager Unit CRUD

Build Units first because Residents, Memberships, and Vehicles depend on them.

Suggested endpoints:

- `GET /api/locations/{location}/units`
- `POST /api/locations/{location}/units`
- `GET /api/units/{unit}`
- `PATCH /api/units/{unit}`
- `DELETE /api/units/{unit}`

Use Location-scoped list endpoints so query scope is obvious and route policies can validate the Location directly.

List behavior:

- Server-side pagination.
- Search by unit number and building name.
- Filter by status.
- Sort by building name, floor, unit number, status, resident count, and created date where practical.
- Default list shows active Units.

Mutation behavior:

- Create active Units by default.
- Update Unit number/building/floor/notes/status.
- Delete action hard-deletes only if no meaningful history exists; otherwise sets status to inactive.
- Inactivating a Unit should prevent it from being used for new Memberships and Vehicles by default.

Resource fields should include:

- Unit summary fields.
- resident count.
- primary contact summary.
- vehicle count if cheap enough, otherwise defer to detail.

### Tests

- Manager can create and edit Units in an accessible Location.
- Manager cannot create Units in inaccessible Location.
- Duplicate Unit number/building within a Location is rejected.
- Same Unit number can exist in different Locations.
- Inactive Units are excluded from default active list.
- Delete falls back to inactive when dependent records exist.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added Manager Unit CRUD API endpoints with Location-scoped listing, Unit create/show/update/delete, server-side pagination/search/status/sort, summary counts, and primary-contact resource data.
- Changed areas: `apps/api/routes/api.php`, `UnitController.php`, `StoreUnitRequest.php`, `UpdateUnitRequest.php`, `UnitResource.php`, `Unit.php`, `UnitMembership.php`, `UnitPolicy.php`, `tests/Feature/ManagerUnitApiTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/ManagerUnitApiTest.php` passed; `./vendor/bin/sail artisan test` passed with 89 tests and 523 assertions; `./vendor/bin/sail pint ...` ran and only formatted `UpdateUnitRequest.php` and `UnitMembership.php`.
- Decisions: Unit create always defaults to `active`; list defaults to active Units unless `status` is supplied; duplicate checks treat null and empty `building_name` as the same building bucket; delete hard-deletes empty Units and inactivates Units with memberships or Vehicles.
- Follow-up: Slice 4 can build Resident and Unit Membership workflows on top of the Unit endpoints and summary relationships.

## Slice 4: Manager Residents and Unit Memberships

Add Resident CRUD and membership assignment as one vertical workflow. Avoid creating Residents without proving the Unit assignment path.

Suggested endpoints:

- `GET /api/accounts/{account}/residents`
- `POST /api/accounts/{account}/residents`
- `GET /api/residents/{resident}`
- `PATCH /api/residents/{resident}`
- `DELETE /api/residents/{resident}`
- `POST /api/residents/{resident}/memberships`
- `PATCH /api/unit-memberships/{membership}`
- `DELETE /api/unit-memberships/{membership}`

Resident list is Account-scoped because Residents are Account-scoped, but it must accept Location and Unit filters:

- Account Admin can list across the Account or filter by Location.
- Location Manager must be constrained to accessible Locations and should not see Residents with no membership in accessible Locations.

Resident create flow:

- Create basic Resident fields.
- Optionally create one or more Unit Memberships in the same request if the UI supports it.
- Each membership sets Unit, resident type, status, and Primary Contact flag.

Membership behavior:

- Resident type belongs to the Unit Membership, not Resident.
- A Resident can have multiple active memberships.
- A Unit can have zero or one active Primary Contact.
- Setting a Membership as Primary Contact replaces the previous Primary Contact for that Unit.
- Inactivating a Primary Contact clears the primary flag.
- Residents with no memberships are incomplete Account-level records visible to Account Admins and cleanup flows only.

### Tests

- Manager can create a Resident and assign them to a Unit.
- Resident can belong to multiple Units.
- Location Manager cannot assign Resident to a Unit outside their accessible Locations.
- Account Admin can manage cross-Location memberships in the Account.
- Primary Contact replacement is atomic.
- Resident hard delete is blocked or converted to inactive when history/memberships exist.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added Manager Resident CRUD and Unit Membership APIs with create-with-memberships, Account-scoped Resident listing, Location Manager scope constraints, membership create/update/inactivate, and primary-contact replacement.
- Changed areas: `apps/api/routes/api.php`, `ResidentController.php`, `UnitMembershipController.php`, `ResidentResource.php`, `UnitMembershipResource.php`, `Resident.php`, `UnitMembership.php`, `tests/Feature/ManagerResidentMembershipApiTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/ManagerResidentMembershipApiTest.php` passed; `./vendor/bin/sail artisan test` passed with 96 tests and 548 assertions; `./vendor/bin/sail pint ...` ran and formatted the new controllers.
- Decisions: Resident deletion hard-deletes only incomplete Residents without memberships or portal links; otherwise it inactivates. Unit Membership deletion inactivates and clears Primary Contact. Location Managers can only list or assign Residents through accessible Unit Memberships; Account Admins can manage cross-Location memberships in the Account.
- Follow-up: Slice 5 can add Resident Invitation and claim-account flow using these Resident and membership APIs as the manager-side foundation.

## Slice 5: Resident Invitation and Claim Flow

M3 should implement a real token claim flow for Residents, not only a placeholder invitation model.

Extend the existing invitation foundation:

- Add `resident` to `UserInvitationPurpose`.
- Add nullable `resident_id` to `user_invitations`, or create a Resident-specific invitation table only if the existing table becomes too awkward.
- Add resident invitation expiry config:
  - `config('wasiy.invitations.resident_expires_days')`
  - `WASIY_RESIDENT_INVITATION_EXPIRES_DAYS=14`

Suggested endpoints:

- `POST /api/residents/{resident}/invitations`
- `GET /api/resident-invitations/{token}`
- `POST /api/resident-invitations/{token}/claim`

Claim behavior:

- Manager creates a pending Resident Invitation for a specific Resident.
- Invitation email should match the Resident email or explicit invite email.
- API stores only token hash, not raw token.
- Email delivery can be basic but real enough: queued Spanish email with a claim link when mail is configured.
- Claim page validates token, lets the Resident set a password, accepts invitation, creates or links a User, and sets `residents.user_id`.
- M3 supports first-time Resident claim. Existing-user merge is deferred unless the email already belongs to the same linked Resident.
- Accepted, expired, or cancelled invitations cannot be reused.

Portal access states:

- `residents.user_id = null`: no portal access.
- pending Resident Invitation: invited but unclaimed.
- `residents.user_id != null`: portal access enabled.
- Inactive Resident: portal access disabled even if `user_id` remains linked.

### Tests

- Manager can invite a Resident in an accessible Location.
- Location Manager cannot invite Resident outside accessible Locations.
- Claiming a valid invitation creates/links User and sets `resident.user_id`.
- Claiming an expired or accepted invitation is rejected.
- Resident Invitation token hash and raw token are never exposed from normal resources.
- Resident Invitation creates activity log entries for invited and claimed events.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added Resident portal invitations on top of `user_invitations`, including manager invite creation, public token lookup, first-time claim, User creation/linking, queued Spanish mail notification, and invited/claimed activity logs.
- Changed areas: `apps/api/routes/api.php`, `ResidentInvitationController.php`, `InviteResidentUser.php`, `ClaimResidentInvitation.php`, `ResidentInvitationNotification.php`, `ResidentInvitationResource.php`, `UserInvitation.php`, `Resident.php`, `config/wasiy.php`, `.env.example`, `tests/Feature/ResidentInvitationClaimApiTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/ResidentInvitationClaimApiTest.php` passed; related invitation/registry/authorization tests passed with 45 tests and 341 assertions; full `./vendor/bin/sail artisan test` passed with 102 tests and 587 assertions; Pint ran on touched PHP files.
- Decisions: Reused `user_invitations` with nullable `resident_id`; raw invite tokens are only passed to the notification and never returned by API resources; existing-user merge remains deferred unless the invitation email already belongs to the same linked Resident.
- Follow-up: Slice 6 can replace the `/api/me` resident memberships placeholder and use `residents.user_id` plus active Unit Memberships as the portal access contract.

## Slice 6: `/api/me` Resident Memberships and Portal Access

Replace the M2 placeholder with real Resident access context.

`/api/me` should return `resident_memberships` for the authenticated User when:

- the User is linked to an active Resident;
- the Resident has active Unit Memberships;
- the Units and Locations are active enough for normal portal operation.

Suggested item shape:

```json
{
  "resident_id": "...",
  "unit_membership_id": "...",
  "account_id": "...",
  "location_id": "...",
  "unit_id": "...",
  "unit_label": "Torre A / 301",
  "resident_type": "owner",
  "is_primary_contact": true
}
```

Portal routing:

- `canAccessPortal` should return true when `resident_memberships.length > 0`.
- Resident-only Users enter `/portal`.
- Staff Users with Resident access may still default to admin/front-desk based on existing route priority, but Portal navigation can be available later if needed.

Portal M3 UI:

- Dashboard shell with household/Unit summary.
- Phone edit form for the linked Resident.
- Vehicle list and create/edit/delete for active Units.

Phone self-service:

- Resident can update only `phone`.
- Resident cannot update name, email, resident type, membership status, Primary Contact, or Unit assignment.
- Phone changes create activity log entries.

### Tests

- `/api/me` returns empty resident memberships for unclaimed Residents.
- `/api/me` returns active memberships for claimed active Residents.
- Inactive Resident or inactive Membership removes Portal access.
- Resident can update own phone.
- Resident cannot update restricted fields.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Replaced the `/api/me` resident membership placeholder with active Resident Unit Membership context, added Portal phone self-service with activity logging, and added a minimal Portal dashboard shell that summarizes Unit access and exposes the phone form.
- Changed areas: `apps/api/app/Services/AccessContextService.php`, `PortalResidentController.php`, `ActivityEventType.php`, `apps/api/routes/api.php`, `apps/api/tests/Feature/MeApiTest.php`, `apps/web/src/features/auth/types.ts`, `apps/web/src/features/portal`, `apps/web/src/routes/_authenticated/portal/index.tsx`, `apps/web/src/i18n/locales`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/MeApiTest.php tests/Feature/AccessAuthorizationServiceTest.php` passed with 30 tests and 165 assertions; full `./vendor/bin/sail artisan test` passed with 107 tests and 616 assertions; `pnpm --filter @wasiy/web test` passed; `pnpm --filter @wasiy/web build` passed with the existing large chunk warning; Pint passed on touched PHP files.
- Decisions: Portal access is driven by `resident_memberships.length > 0`; membership entries include the backend-provided `unit_label`; phone self-service rejects restricted Resident and Membership fields explicitly; vehicle portal UI remains deferred to Slice 7 because Vehicle APIs are not implemented yet.
- Follow-up: Slice 7 can add manager and portal Vehicle endpoints, then extend the Portal dashboard with Unit-owned Vehicle management.

## Slice 7: Vehicle Management

Build one Vehicle model shared by manager and portal workflows.

Suggested manager endpoints:

- `GET /api/locations/{location}/vehicles`
- `POST /api/locations/{location}/vehicles`
- `GET /api/vehicles/{vehicle}`
- `PATCH /api/vehicles/{vehicle}`
- `DELETE /api/vehicles/{vehicle}`

Suggested portal endpoints:

- `GET /api/portal/vehicles`
- `POST /api/portal/vehicles`
- `PATCH /api/portal/vehicles/{vehicle}`
- `DELETE /api/portal/vehicles/{vehicle}`

Manager behavior:

- Can create/edit Vehicles for Units in accessible Locations.
- Can change Vehicle Unit.
- Can see Vehicles by Location, Unit, type, status, plate, and search.

Resident behavior:

- Can manage Vehicles for Units where they have active Unit Membership.
- Must choose Unit when they have multiple active Units.
- Cannot move a Vehicle to a Unit they do not belong to.
- Cannot create Vehicle for inactive Unit or inactive Membership.

Deletion behavior:

- Vehicle can be hard-deleted in M3 when it has no meaningful dependent history.
- Keep `status` so future history-heavy vehicle workflows can use inactive records.

### Tests

- Manager can create and edit Vehicle for accessible Unit.
- Manager cannot create Vehicle for inaccessible Unit.
- Resident can create Vehicle for their active Unit.
- Resident cannot update another Unit's Vehicle.
- Vehicle account/location/unit scope is enforced on create and update.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added shared Vehicle management APIs for manager registry workflows and Resident portal workflows, including Location-scoped manager listing, manager create/show/update/delete, portal list/create/update/delete, active Unit assignment validation, and Resident Unit ownership constraints.
- Changed areas: `apps/api/routes/api.php`, `VehicleController.php`, `VehicleResource.php`, `VehiclePolicy.php`, `tests/Feature/VehicleManagementApiTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/VehicleManagementApiTest.php` passed; related registry/portal/authorization tests passed with 50 tests and 256 assertions; full `./vendor/bin/sail artisan test` passed with 114 tests and 653 assertions; Pint passed on touched PHP files.
- Decisions: Manager Vehicle create/update requires an active Unit in the route Location; manager list supports Unit, type, status, plate, search, sort, and pagination; Resident portal Vehicle mutations are limited to active Unit Memberships and cannot set `status`; Vehicle deletes hard-delete in M3.
- Follow-up: Slice 8 can build Registry frontend pages and can consume `/api/locations/{location}/vehicles`; Portal UI can later consume `/api/portal/vehicles` for Resident self-service Vehicle management.

## Slice 8: Registry Frontend Pages

Add one Registry navigation group with separate routes:

- `/admin/registry/units`
- `/admin/registry/residents`
- `/admin/registry/vehicles`

Navigation label:

- `Registro`

Route and feature folders should follow the existing feature-first frontend structure:

- `features/units`
- `features/residents`
- `features/vehicles`
- `features/exports` if export UI becomes shared

Each page should use:

- TanStack Table for state.
- TanStack Router search params for pagination, filters, and sorting.
- TanStack Query for fetching.
- React Hook Form and Zod for forms.
- Mantine inputs, drawers/modals, notifications, and confirmation modals.
- Spanish copy from i18n files.

Recommended pages:

- Units list: unit label, building/floor, status, resident count, Primary Contact.
- Residents list: name, phone, portal status, active memberships, status.
- Vehicles list: plate, type, Unit, color/make/model, status.

Create/edit flows can use drawers in M3. Use full pages only if membership assignment becomes too dense for a drawer.

### Tests

- Table state is reflected in URL search params.
- Lists render paginated API data.
- Create/edit forms show Laravel validation errors.
- Mutations invalidate the right list/detail queries.
- Navigation shows Registry for Account Admin and Location Manager.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added the admin Registry frontend group with `/admin/registry/units`, `/admin/registry/residents`, and `/admin/registry/vehicles` pages using server-backed pagination/filter/search state, TanStack Table/Router/Query, and Mantine drawer create/edit forms.
- Changed areas: `apps/web/src/routes/_authenticated/admin/registry`, `apps/web/src/features/units`, `apps/web/src/features/residents`, `apps/web/src/features/vehicles`, `apps/web/src/features/registry`, `apps/web/src/features/auth/access.ts`, `apps/web/src/i18n/locales`, `apps/web/src/routeTree.gen.ts`.
- Verification: `pnpm --filter @wasiy/web test` passed with 5 files and 19 tests; `pnpm --filter @wasiy/web lint` passed; `pnpm --filter @wasiy/web build` passed with the existing large chunk warning.
- Decisions: Units and Vehicles pages require an active Location; Residents list is Account-scoped and applies the active Location filter when present; Resident create supports optional initial Unit Membership assignment while edit remains basic Resident fields; known TanStack Table React Compiler lint warnings are suppressed at the local `useReactTable` call sites.
- Follow-up: Slice 9 can add Export actions to these table pages once the queued export foundation exists.

## Slice 9: Queued CSV Exports

Implement the export foundation in M3 instead of immediate controller downloads.

Suggested table:

- `exports`
- `id`
- `account_id`
- nullable `location_id`
- `requested_by_user_id`
- `export_type`
- `filters`
- `status`
- nullable `disk`
- nullable `path`
- `filename`
- `expires_at`
- nullable `completed_at`
- nullable `failed_at`
- nullable `failure_reason`
- timestamps

Export types:

- `registry_units_residents`
- `vehicles`

Export statuses:

- `pending`
- `processing`
- `ready`
- `failed`
- `expired`

Suggested endpoints:

- `POST /api/exports`
- `GET /api/exports`
- `GET /api/exports/{export}`
- `GET /api/exports/{export}/download`

Behavior:

- Export requests store the filters used by the current table.
- Queue job generates CSV and stores it on configured storage.
- Ready export exposes a temporary or controlled download URL.
- Export files expire after a configured retention period.
- Account Admin can export Account-wide or Location-filtered data.
- Location Manager can export only accessible Locations.
- CSV headings should be Spanish for v1 operational exports.

Config:

- `config('wasiy.exports.disk')`
- `config('wasiy.exports.expires_days')`
- `WASIY_EXPORT_DISK=s3`
- `WASIY_EXPORT_EXPIRES_DAYS=7`

### Tests

- Manager can request Units/Residents export for accessible scope.
- Manager cannot export inaccessible Location data.
- Job writes CSV with expected headings and rows.
- Export status transitions from pending to ready or failed.
- Download is denied until ready.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Added the queued CSV export foundation with `exports` tracking, export type/status enums, request/list/show/download endpoints, scoped authorization, queued CSV generation for Unit/Resident registry and Vehicles, storage-backed downloads, and export activity events.
- Changed areas: `apps/api/app/Http/Controllers/Api/RegistryExportController.php`, `GenerateCsvExport.php`, `RegistryExport.php`, `RegistryExportPolicy.php`, `RegistryExportResource.php`, `database/migrations/2026_06_13_000002_create_exports_table.php`, `tests/Feature/QueuedCsvExportApiTest.php`, `config/wasiy.php`, `.env.example`, `routes/api.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/QueuedCsvExportApiTest.php` passed; related registry/vehicle/authorization tests passed with 40 tests and 186 assertions; full `./vendor/bin/sail artisan test` passed with 119 tests and 678 assertions; Pint ran on touched PHP files and only reformatted the new export factory.
- Decisions: Location Managers must provide an accessible `location_id`, while Account Admins may request Account-wide or Location-filtered exports. Downloads return `409` until the export is ready, and generated files use configured disk/retention values.
- Follow-up: Slice 10 can extend activity logging across Unit, Resident, Membership, and Vehicle mutations using the export event pattern added here.

## Slice 10: Activity Logging

Extend `ActivityEventType` for registry events.

Suggested event types:

- `unit.created`
- `unit.updated`
- `unit.inactivated`
- `resident.created`
- `resident.updated`
- `resident.inactivated`
- `resident.phone_updated`
- `resident.invited`
- `resident.claimed`
- `unit_membership.created`
- `unit_membership.updated`
- `unit_membership.inactivated`
- `unit_membership.primary_contact_changed`
- `vehicle.created`
- `vehicle.updated`
- `vehicle.deleted`
- `vehicle.inactivated`
- `export.requested`
- `export.completed`
- `export.failed`

Activity semantics:

- Registry workflow actions should log inside the same transaction as the mutation when the mutation is user-facing and sensitive.
- Activity rows should store Spanish `summary` snapshots.
- Metadata should include stable IDs and labels for Account, Location, Unit, Resident, Membership, Vehicle, and actor where relevant.
- Use `subject_type` and `subject_id` for the primary changed record.
- Unit Membership events should usually be Location-scoped.
- Resident events without a single Location can be Account-scoped, but membership-related Resident events should include the affected Location.
- Vehicle events are Location-scoped.
- Export events are Account-scoped or Location-scoped depending on the export request.

No-op updates should not create Activity Log rows.

### Tests

- Unit create/update/inactivate logs activity.
- Resident create/update/inactivate logs activity.
- Membership changes log activity and include Resident and Unit labels.
- Primary Contact replacement logs one meaningful event.
- Resident invitation and claim log activity.
- Resident phone update logs activity.
- Vehicle changes log activity.
- Export request and completion log activity.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Extended registry activity logging across Unit, Resident, Unit Membership, Primary Contact, and Vehicle mutation paths with Spanish summary snapshots, stable metadata labels/IDs, model-class subjects, Location scoping where applicable, and no-op update suppression. Existing Resident invitation, claim, phone update, and export activity logs remain covered.
- Changed areas: `apps/api/app/Enums/ActivityEventType.php`, `UnitController.php`, `ResidentController.php`, `UnitMembershipController.php`, `VehicleController.php`, `tests/Feature/RegistryActivityLoggingApiTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/RegistryActivityLoggingApiTest.php` passed; related registry/invitation/export/portal tests passed with 51 tests and 289 assertions; full `./vendor/bin/sail artisan test` passed with 124 tests and 717 assertions; Pint ran on touched PHP files and only removed an unused import from the new test.
- Decisions: Hard-deleted empty Units and Residents still do not log a deleted event because Slice 10 defines Unit/Resident inactivation events, not delete events. Vehicle hard deletes log `vehicle.deleted`; status changes to inactive log `vehicle.inactivated`. Primary Contact replacement logs one `unit_membership.primary_contact_changed` event instead of logging every implicit prior-contact clearing.
- Follow-up: Slice 11 can add seed scenarios and final acceptance checks against the completed registry, portal, vehicle, export, and activity-log behavior.

## Slice 11: Seed Scenarios and Acceptance

Add enough seed data to manually verify M3 without imports:

- Several Units in `edificio-central` and `torre-norte`.
- Active and inactive Units.
- Residents with active memberships.
- One Resident with memberships in multiple Units.
- One Unit with a Primary Contact.
- One invited but unclaimed Resident.
- One claimed Resident portal user.
- Vehicles assigned to Units.

Suggested seeded portal user:

- `resident@wasiy.test` / `password`
- Linked to an active Resident with at least one active Unit Membership.

Final M3 acceptance checks:

- Manager can create and edit Units.
- Manager can create Residents and assign them to Units.
- A Unit can have zero or one active Primary Contact.
- A Resident can belong to multiple Units.
- Resident can claim portal access.
- Resident can update own phone number.
- Resident can manage Vehicles for active Units they belong to.
- Resident cannot change Unit Membership, resident type, Primary Contact, name, email, or Unit assignment.
- Managers can manage Unit-owned Vehicles.
- Managers can request queued registry and Vehicle CSV exports.
- Authorization tests cover Account and Location scoping.
- Activity Log entries exist for key registry changes.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-13
- Summary: Expanded the demo seeder into an idempotent M3 registry fixture with active/inactive Units across `edificio-central` and `torre-norte`, Residents with active memberships, a multi-Unit Resident, one primary-contact Unit, one pending Resident invitation, a claimed Resident portal user, and Unit-owned Vehicles. Added seeded acceptance checks for portal access, Resident phone/vehicle self-service restrictions, manager registry creation, exports, and activity logs.
- Changed areas: `apps/api/database/seeders/DatabaseSeeder.php`, `apps/api/tests/Feature/DatabaseSeederTest.php`.
- Verification: `./vendor/bin/sail artisan test tests/Feature/DatabaseSeederTest.php` passed; related registry/portal/export/activity suites passed with 58 tests and 381 assertions; full `./vendor/bin/sail artisan test` passed with 127 tests and 752 assertions; Pint passed on touched seeder/test files.
- Decisions: Seeded portal credentials are `resident@wasiy.test` / `password`. The pending Resident invitation uses a deterministic hashed demo token only for fixture stability and still stores no raw token. Seeded registry data is managed with `updateOrCreate` and stable natural keys so repeated seeding stays idempotent.
- Follow-up: M3 backend acceptance is complete; frontend export controls can be a later UX enhancement because the queued export API contract is now present and verified.

## Suggested Pull Request Breakdown

1. Registry schema, enums, models, factories, and invariant tests.
2. Registry authorization helpers and policies.
3. Manager Unit CRUD API.
4. Manager Resident and Unit Membership API.
5. Resident Invitation and claim flow.
6. `/api/me` resident memberships and Portal access.
7. Vehicle APIs for managers and Residents.
8. Registry frontend pages and navigation.
9. Queued export foundation with registry and vehicle exports.
10. Activity logging, seed scenarios, and final acceptance tests.

## Definition of Done

M3 is done when the product can correctly answer these questions from backend-owned data:

- Which Units exist in this Location and are active for operations?
- Which Residents are associated with which Units?
- Which Unit Membership is the Primary Contact for a Unit?
- Which Resident has claimed Portal access?
- Which active Units can this Resident operate on in the Portal?
- Which Vehicles belong to this Unit?
- Which registry records can this Manager view or mutate?
- Which CSV export did this Manager request, what filters did it use, and is it ready?
- Who changed core registry data, invited a Resident, claimed portal access, updated a phone number, or changed Vehicles?
