# M6 Roadmap: Location Management and Amenities

## Goal

M6 turns the Location from a seeded row into a managed record. Account Admins get full CRUD over Locations, a structured address, photos, and operational settings that cascade from the Account; Location Managers get the Amenity setup that the reservations milestone depends on.

Today `/admin/locations` renders `PagePlaceholder` and the backend has no Location controller at all — only `LocationPolicy::view`. Locations exist because the seeder creates them. Amenities do not exist anywhere in code, despite being fully specified in the PRD and given a photo upload contract in the TRD.

The main risk in M6 is scope. Amenities are a feature in their own right — photos, an availability editor, booking policy, fees — and they are the direct dependency of reservations. They are sequenced last so Locations become usable before Amenity work begins, and so the Amenity slices can slip to their own milestone without stranding anything.

Designs for every screen in this milestone exist in `docs/mockups/Mockups.dc.html`, artboards 02 through 06h. They are the authority on layout and Spanish copy; this document is the authority on behavior and data.

## Current Starting Point

Already present:

- `locations` table with ULID key, `account_id`, `name`, `slug`, `timezone`, `address`, timestamps, soft deletes.
- Composite unique `(id, account_id)`, unique `(account_id, slug)`, indexes on `(account_id, name)` and `(account_id, deleted_at)`.
- `Location` model with `account`, `staffLocationRoles`, `units`, `unitMemberships`, `vehicles` relations.
- `LocationPolicy::view` delegating to `AccessAuthorizationService::canAccessLocation`.
- `location_user_roles` with a composite foreign key to `(location_id, account_id)`.
- Session-backed Active Location context and `accessible_locations` on `/api/me`.
- `/admin/locations` guarded by `checkSurfaceAccess(context.me, isAccountAdmin)`.
- Shared `DataTable` in `components/table/`, with the staff feature as the reference pattern for list, filters, drawer, and deactivate modal.
- `ActivityLog` model and an `/admin/activity` surface.
- `RegistryExport` on the `exports` table, already carrying `location_id`, `export_type`, and `filters`, with index/store/show/download routes.
- `@mantine/dropzone` chosen in the TRD for photo and CSV upload.

Still missing for M6:

- Any Location write endpoint, form request, action, or resource.
- Structured address fields; today a single `address` string.
- Location type and access notes.
- Location deactivation.
- Account-level and Location-level operational settings.
- Photo storage for any entity.
- The entire Amenity domain.

## Decisions Confirmed

**Amenities live inside the Location detail page.** CONTEXT.md defines an Amenity as a facility inside a Location, and a top-level route would be ambiguous for an Account Admin with no Active Location selected. Amenity routes nest under the Location.

**The address is split into components,** including `district`. The existing single `address` string will not survive exports or the M4 CSV import, and District is a real addressing level in Peru that front desk staff use.

**Settings cascade Account → Location → Amenity.** A company managing several buildings sets a policy once. Each level stores only what it overrides; every read resolves through the chain to one effective value.

**Locations are created active.** Deactivation means a property was operational and has been retired — it is not a staging state. A new Location has no Units, Residents, or portal users, so creating it inactive hides it from nobody, and because deactivated Locations are excluded from `accessible_locations`, it could not be selected as an Active Location to load data into. Mockup 06b's "Se crea inactiva hasta que confirmes los datos" does not ship. A separate portal-visibility flag was considered and explicitly rejected.

**An Amenity has one lifecycle flag, not two.** Mockup 06d offers both "Pausar" and "Desactivar" while describing them almost identically — both hide the Amenity from the portal and both preserve existing reservations. Modelling three flags for a distinction the copy cannot articulate is not worth it. M6 ships `is_reservable` (Común vs Reservable) and `deactivated_at` (Inactiva). The "Pausada" badge, the "Guardar y pausar" button, and the "Pausar" option in the deactivate modal are dropped.

**Errors do not carry support codes.** Mockup 06e shows `AMN-503`. No such convention exists in the API, and inventing one for a single empty state is not justified. The error state keeps its copy and its retry, without the code.

**"Exportar CSV" reuses the existing export flow.** The Location header action posts to `/exports` with this `location_id` and the units-and-residents export type. No new backend.

## Implementation Strategy

Backend first — unlike M1 through M5 there is no partial backend to build on. Land settings and schema, then the Location CRUD API, then the list, then the detail shell, then Amenities.

Recommended order:

1. Settings cascade: Account and Location settings.
2. Location schema: structured address, type, access notes, deactivation.
3. Location CRUD API.
4. Polymorphic photo storage.
5. Locations list page.
6. Location detail shell — header, tabs, Información, Personal.
7. Configuración tab.
8. Amenity domain and API.
9. Amenity management UI.
10. Seed scenarios and final acceptance.

Slices 1 through 7 deliver a complete, shippable Location feature. Slices 8 and 9 may become their own milestone without blocking anything before them.

## Slice 1: Settings Cascade

Build the cascade before anything reads it, so no caller ever learns to read a raw array key.

Migration `add_settings_to_accounts_and_locations`:

- Add nullable `json` column `settings` to `accounts`.
- Add nullable `json` column `settings` to `locations`.

`OperationalSettings` value object with typed properties and a default for every field:

- `visitor_preregistration_enabled` (bool)
- `visitor_auto_checkout_hours` (int|null, null meaning never)
- `reservation_max_advance_days` (int)
- `reservation_max_concurrent_per_unit` (int)
- `reservation_cancellation_window_hours` (int)
- `quiet_hours_enabled` (bool)
- `quiet_hours_start` / `quiet_hours_end` (time|null)
- `announcements_location_manager_can_post` (bool)
- `announcements_email_residents` (bool)

`SettingsResolver` service:

- `forAccount(Account): OperationalSettings` — system defaults with the Account's overrides applied.
- `forLocation(Location): OperationalSettings` — the Account's resolved settings with the Location's overrides applied.
- `explain(Location): array` — per key, the effective value, the level it came from, and the value the next level up would have given. The Configuración tab renders "En vigencia: 12 horas · valor de la cuenta: 24 horas" straight from this; without it the frontend would re-implement the cascade.

Each level stores only the keys it overrides. An absent key inherits; it is not the same as a key explicitly set to the parent's current value, because the parent may later change.

Amenity-level overrides join this chain in Slice 8 and use the same resolver.

### Slice 1 Tests

- A null `settings` column at both levels resolves to system defaults.
- A Location override wins over an Account value.
- A key absent at the Location inherits the Account value, and follows it when the Account value later changes.
- A key set at the Location to the same value as the Account does not follow a later Account change.
- `explain()` reports the correct source level for inherited, overridden, and defaulted keys.
- Writing an unknown key is rejected.

## Slice 2: Location Schema

Migration `restructure_locations_table`:

- Add `address_line1`, `address_line2`, `district`, `city`, `state`, `postal_code`, `country`. All nullable strings except `country`, defaulting to `PE`.
- Backfill `address_line1` from the existing `address`, then drop `address`.
- Add `type` (string, backed by an enum) and nullable `access_notes` text.
- Add nullable `phone` and `contact_email`.
- Add nullable `deactivated_at`, plus `deactivated_by_user_id` — mockup 06f names who deactivated the Location and when.
- Index `(account_id, deactivated_at)` to cover the list page's status filter.

`LocationType` enum: `multifamily_building`, `condominium`, `residential_community`, `other`. String-backed so new types need no migration.

Model changes:

- Extend the `#[Fillable]` attribute with the new columns. `settings` stays out of it; it is written only through the settings action.
- Cast `deactivated_at` to `datetime`, `type` to `LocationType`, `settings` through the Slice 1 cast.
- Scopes `active()` and `deactivated()`.
- `formattedAddress()` accessor joining present components, for tiles, table cells, and exports.
- `amenities()` relation arrives in Slice 8.

Deactivation keeps Units, Residents, and history, disappears from `accessible_locations`, and is rejected as an Active Location. It is not a soft delete; soft delete remains for genuine mistakes.

### Slice 2 Tests

- The migration backfills `address_line1` from `address` and drops the old column.
- `formattedAddress()` omits absent components without leaving stray separators.
- `active()` excludes deactivated rows; `deactivated()` is its complement.
- An unknown `type` value fails to cast.

## Slice 3: Location CRUD API

Routes under `/api/accounts/{account}/locations`:

- `GET /` — paginated list with `search`, `status`, `type`, `per_page`, including the counts the tiles render.
- `POST /` — create, active.
- `GET /{location}` — detail.
- `PATCH /{location}` — identity, address, contact, access notes.
- `POST /{location}/deactivate`, `POST /{location}/reactivate`.
- `GET /{location}/settings` — resolved values plus the `explain()` payload.
- `PUT /{location}/settings` — settings are written separately from identity so the Información form and the Configuración groups never contend.
- Account-level settings get the parallel pair on `/api/accounts/{account}/settings`.

`LocationPolicy` gains `viewAny`, `create`, `update`, `deactivate`, `viewSettings`, `updateSettings`. Only an Account Admin may create, rename, or deactivate a Location. A Location Manager may read and update settings and Amenities for an assigned Location but not its identity — mirroring the rule that only an Account Admin creates staff or changes roles. Only an Account Admin may write Account settings.

Requests and validation:

- `StoreLocationRequest` / `UpdateLocationRequest`. `name`, `type`, `address_line1`, and `city` required — 06b marks exactly these with an asterisk. `timezone` validated against the PHP identifier list, `contact_email` as an email, `country` as a two-letter code.
- The slug derives from the name and is unique per Account. Renaming does not change the slug; slugs are stable identifiers and a rename should not break bookmarks.
- A duplicate name in the same Account is rejected with the message 06b shows, not a slug collision error.
- `UpdateSettingsRequest` validates each key independently, rejects unknown keys, and accepts a null to clear an override back to inherited.

Deactivation guards:

- Deactivating a Location with active Units is allowed. The response reports affected Units, Residents, staff, and future reservations so the modal can warn first. Future reservations return zero until the reservations milestone.
- Deactivating the caller's Active Location clears the session Active Location.
- The last active Location in an Account cannot be deactivated; the response reports active and inactive counts for the blocked variant in 06d.
- Deactivation stamps `deactivated_by_user_id` and `deactivated_at`.

Resources: `LocationResource` with identity, type, component and formatted address, contact, access notes, status, deactivation metadata, timezone, `units_count`, `residents_count`, `vehicles_count`, `unclaimed_invitations_count`, `staff_count`, `active_amenities_count`, and photos. `LocationSettingsResource` separately, carrying effective values and their sources.

Activity logging: `LocationCreated`, `LocationUpdated`, `LocationDeactivated`, `LocationReactivated`, `LocationSettingsChanged`, `AccountSettingsChanged`.

### Slice 3 Tests

- A user from another Account gets 404, not 403, on every route.
- A Location Manager can read and update settings for an assigned Location and gets 403 on rename, create, and deactivate.
- A Location Manager gets 403 on Account settings.
- A newly created Location is active and appears in `accessible_locations` immediately.
- A duplicate name in one Account is rejected; the same name in two Accounts is allowed.
- Renaming leaves the slug unchanged.
- Deactivating the last active Location fails and returns the counts.
- Deactivating the caller's Active Location clears the session context.
- Deactivated Locations are absent from `accessible_locations`.
- `PUT /settings` with a null clears an override back to inherited.
- Every mutation writes exactly one activity entry.

## Slice 4: Polymorphic Photo Storage

Locations and Amenities both need photos, so build it once.

Migration `create_photos_table`: ULID key, `account_id`, `photoable_type`, `photoable_id`, `disk`, `path`, `original_filename`, `mime_type`, `size_bytes`, `sort_order`, `is_cover`, timestamps. Index `(photoable_type, photoable_id, sort_order)` and `(account_id)`.

Behavior, following the TRD's upload contract and mockup 03:

- Upload through the API; the SPA never writes to storage directly.
- Laravel is authoritative for MIME and size regardless of what the dropzone accepted. JPG and PNG, 10 MB maximum, as the dropzone copy states.
- Maximum 10 photos per owner, enforced server-side.
- Deleting a photo removes the stored file.
- Zero or one `is_cover` per owner; setting a new cover clears the previous.
- Reordering accepts an ordered list of ids and rewrites `sort_order` in one transaction.

Endpoints nest under the owner: `POST /{owner}/photos`, `DELETE /{owner}/photos/{photo}`, `PUT /{owner}/photos/order`, `POST /{owner}/photos/{photo}/cover`. A shared trait or invokable action keeps Location and Amenity from diverging. Authorization delegates to the owner's policy.

### Slice 4 Tests

- An eleventh photo is rejected.
- An image extension with a non-image MIME type is rejected.
- A file over 10 MB is rejected.
- Deleting removes the file from the fake disk.
- Setting a cover clears the previous cover for that owner only.
- Reordering with an id belonging to another owner is rejected.
- Cross-account upload and read are rejected.

## Slice 5: Locations List Page

Replace `PagePlaceholder` at `/admin/locations`. Mockup 02, with empty states in 06e.

This page is a photo-tile card list, not a `DataTable` — the one deliberate exception in the admin surface. Locations are few, the cover photo carries real recognition value, and each tile shows five counts that read poorly as columns. Every other list in this milestone stays a table.

- `features/locations/` with `api.ts`, `schemas.ts`, `locations-page.tsx`, `location-card.tsx`, `location-filters.tsx`, `location-form-drawer.tsx`, `location-deactivate-modal.tsx`, `location-empty-state.tsx`.
- Search params typed and validated on the route as staff does: `page`, `search`, `status`, `type`.
- Each tile: cover photo or a "Sin fotos aún" placeholder, name, status badge, formatted address, and counts for unidades, residentes, vehículos, staff, and invitaciones sin reclamar. The Active Location tile carries the "Ubicación activa" marker.
- Filters: text search, status, and type.
- Create and edit share one drawer in two modes, matching `StaffAccessDrawer`.
- Empty states distinguish no Locations at all from no filter results, each with its own action — 06e gives both.
- Query keys share a `['locations']` prefix so one mutation invalidates the feature.
- Spanish and English strings for every label, filter, and state.

### Slice 5 Tests

- Tiles render from a mocked list response, including the no-photo placeholder.
- Changing a filter updates the URL and refetches.
- Creating a Location closes the drawer and shows an active tile.
- The zero-locations and zero-results states render their distinct copy and actions.
- A non-admin hitting the route by URL is turned away by the existing guard.

## Slice 6: Location Detail Shell

Route `/admin/locations/$locationId`, mockups 03, 05, 06b, 06d, 06f, 06g. The active tab lives in the URL so it is linkable and survives reload.

Header: cover photo with "Cambiar portada", breadcrumb, name, status badge, formatted address and timezone, "Exportar CSV", and "Editar ubicación". Tabs: Información · Amenidades · Personal · Configuración. The Amenidades tab renders a coming-soon state until Slice 9.

Información tab:

- Stats row: unidades, residentes, vehículos, invitaciones sin reclamar, amenidades activas.
- "Información general" card in read view with an "Editar" affordance opening the drawer. All seven address fields, plus name, type, timezone, phone, operational email, and access notes.
- Photo gallery with dropzone upload, cover selection, delete, and drag reorder, per 03 and the empty variant in 06e.

Create and edit drawer (06b): 480 px right-side panel, one component in two modes, sectioned into identity, Dirección, and Contacto. Required fields are name, type, address line 1, and city. Edit mode adds a "Zona sensible" footer with Desactivar. Validation errors bind inline through `applyLaravelValidationErrors`, with the summary banner 06b shows.

Personal tab (05): read-only. Columns Persona · Rol · Acceso, sourced from the existing staff endpoint filtered by `location_id`, with the read-only notice and a "Gestionar en Personal" link to `/admin/staff`. Assignment is not duplicated here — two places to assign roles means two places to keep the account-role versus location-role mutual-exclusion rule correct. Empty state per 06e.

Deactivated variant (06f): persistent banner naming who deactivated it and when, every form read-only with an "Edición bloqueada" affordance, and "Reactivar ubicación" as the only available action.

Deactivate modal (06d): affected counts before confirming, and the blocked last-active-location variant with its own copy and active/inactive counts.

Tablet (06g): tables keep their columns and scroll horizontally inside their card; they do not become stacked cards. Drawers become full-width sheets with a fixed footer action bar.

### Slice 6 Tests

- The active tab is read from and written to the URL.
- An unknown location id renders a not-found state rather than a crashed route.
- A deactivated Location renders the banner, read-only forms, and only the reactivate action.
- Saving the identity form sends identity fields only, never settings.
- A duplicate-name response binds to the name field with the server message.
- Uploading a photo optimistically appends and rolls back on failure.
- The Personal tab renders assignments and its empty state, and exposes no mutation.
- The deactivate modal renders both the normal and the blocked variant from their API responses.

## Slice 7: Configuración Tab

Mockup 06 renders the resolved cascade as four groups, each saving independently — not one page-wide save, so a mistake in one group does not block another. Each group has its own Descartar and Guardar.

- Visitas — pre-registro por residentes, and cierre automático as a segmented control over 4 h, 8 h, 12 h, 24 h, and Nunca.
- Reservas — días de anticipación máx., reservas simultáneas por unidad, ventana de cancelación, each stepper labelled as a default an Amenity may override.
- Horario de silencio — enabled toggle with start and end, shown in the Location's timezone.
- Anuncios — whether Location Managers may publish, and optional resident email.

Every control shows its effective value, and every group shows the "En vigencia … · valor de la cuenta …" line from `explain()`. A control whose value is inherited is visibly inherited; clearing it returns it to inherited rather than writing the parent's current value.

The same component renders Account-level settings under `/admin/settings`, without the inheritance lines, since that level has no parent.

### Slice 7 Tests

- A Location with no overrides renders inherited Account values with defaults behind them, never empty inputs.
- Saving one group sends only that group's keys.
- Clearing an override sends null and the control returns to showing the inherited value.
- The "en vigencia" line reflects the resolver, not a client-side recomputation.
- A server validation error binds to the correct control.
- A Location Manager can open and save this tab for an assigned Location and cannot reach Account settings.

## Slice 8: Amenity Domain and API

Migration `create_amenities_table`:

- ULID key, `account_id`, `location_id` with the composite foreign key to `(id, account_id)`.
- `name`, `slug`, `type`, `description` (nullable text), `capacity` (int|null).
- `is_reservable` boolean.
- `booking_mode` — instant or approval.
- `availability` json — per-weekday open and close windows.
- `max_duration_minutes`, `min_duration_minutes`, `buffer_minutes`, `max_advance_days`, `max_concurrent_per_unit`, `cancellation_window_hours` — all nullable, null meaning inherit from the Location.
- `fee_amount`, `deposit_amount` as integer soles, nullable. Whole soles, no decimals, per 06c.
- `deactivated_at`, timestamps, soft deletes.
- Unique `(location_id, slug)`; index `(account_id, location_id, deactivated_at)`.

`AmenityType` enum: `pool`, `gym`, `event_room`, `meeting_room`, `court`, `rooftop`, `other`. `BookingMode` enum: `instant`, `approval`.

`AmenityAvailability` value object over the json column, exposing the windows for a weekday and validating that windows within a day do not overlap and that close follows open. Zero windows means closed.

The nullable policy fields resolve through the Slice 1 `SettingsResolver`, extended with an Amenity level, so the reservations milestone reads one effective value and never re-implements the fallback.

Routes under `/api/accounts/{account}/locations/{location}/amenities`: index, store, show, update, deactivate, reactivate, plus the Slice 4 photo endpoints.

`AmenityPolicy`: an Account Admin, or a Location Manager assigned to the Location, may manage Amenities. Front Desk may view only.

Activity logging: `AmenityCreated`, `AmenityUpdated`, `AmenityDeactivated`, `AmenityReactivated`.

### Slice 8 Tests

- An Amenity cannot be created under a Location in another Account.
- A Location Manager assigned elsewhere gets 403.
- Overlapping windows on one weekday are rejected.
- A close time before its open time is rejected.
- A day with zero windows persists as closed.
- A null `max_advance_days` resolves through the Location to the Account; a set value wins.
- A non-reservable Amenity ignores booking-policy and fee fields.
- Deactivating an Amenity leaves it visible under the inactive filter.
- The deactivate response reports future reservation count, zero until reservations exist.

## Slice 9: Amenity Management UI

Renders in the Location detail Amenidades tab. Mockups 04, 06c, 06d, with empty, loading, and error states in 06e.

The list is a table: Amenidad, with a cover thumbnail and the type badge beneath the name · Horario · Aforo · Cuota / depósito · Aprobación · Estado · Acciones. Estado reads Reservable, Común, or Inactiva. Aprobación reads Instantánea or Requiere aprobación, and a dash for a non-reservable common space.

Drawer (06c): 620 px, full height, sectioned into Básicos, Fotos, Disponibilidad, Política de reserva, and Cuotas.

The availability editor is the most important control in this feature and 06c specifies it precisely:

- One weekday per row, each holding zero or more open and close windows. Zero windows renders the day dimmed with an "Abrir y agregar horario" shortcut.
- Per-window remove, and "Agregar horario" to append below.
- "Copiar a todos los días" replicates a day's windows across the other six, undoable from the notice that follows.
- Overlap validates as you type and blocks saving until resolved, naming the overlapping range. The server remains authoritative.
- Times are in the Location's timezone, stated in the section header.

Booking policy fields show the inherited value as helper text — "Vacío = heredar de la ubicación (30 días)" when empty, "Sobrescribe el valor de la ubicación (2)" when set — so inheritance is visible rather than implied. Fees are whole soles with the S/ prefix.

Deactivate confirms and warns when future reservations exist, per 06d minus the dropped "Pausar" option.

The loading state is skeleton rows at the real row height, no spinner and no header shift. The error state keeps its copy and retry, without a support code.

### Slice 9 Tests

- The table renders from a mocked list response, including the common-space dashes.
- The availability editor blocks an overlapping window before submitting and names the range.
- Copiar a todos los días replicates one day across the week and can be undone.
- A day emptied of windows submits as closed.
- An empty policy field submits null rather than the placeholder value.
- Fee inputs reject decimals and submit integers, including zero and empty.
- Empty, loading, and error states render per 06e.

## Slice 10: Seed Scenarios and Final Acceptance

- Seed four Locations in the demo Account matching mockup 02: three active, one inactive without photos.
- Seed Account-level settings with at least one key the Locations inherit and one a Location overrides, so the Configuración cascade has something real to show.
- Seed Amenities covering each combination: reservable instant with no fee, reservable with approval and a fee plus deposit, reservable instant with a fee, non-reservable common space, and deactivated.
- Seed photos for at least one Location and one Amenity, including a cover.
- Verify manually end to end: create a Location, fill all seven address fields, upload photos, override a setting, add an Amenity with a two-window day and a closed day, deactivate the Amenity, deactivate the Location, hit the last-active-location block, reactivate.

### Slice 10 Tests

- Full backend suite green.
- Full frontend suite green.
- Authorization tests cover cross-account and cross-location access for every new route.

## Suggested Pull Request Breakdown

1. Slices 1–2: settings cascade and Location schema.
2. Slice 3: Location CRUD API.
3. Slice 4: photo storage.
4. Slices 5–6: list page and detail shell.
5. Slice 7: Configuración tab.
6. Slice 8: Amenity domain and API.
7. Slices 9–10: Amenity UI and seeds.

## Deferred

**Shift scheduling and staff presence.** Mockups originally showed per-staff shifts, an in-shift indicator, and last-activity timestamps on the Personal tab. No schedule model exists and nothing tracks last activity; it is a feature in its own right and was cut from these designs.

**Location staging.** A draft or unpublished state was considered and rejected. Deactivation covers retirement; staging protects nothing at creation time.

**Amenity pause as a state distinct from deactivation.** Revisit only with a concrete behavioral difference.

## Definition of Done

- An Account Admin can create, edit, deactivate, and reactivate a Location, with a full structured address, type, access notes, and photos.
- Operational settings resolve Account → Location → Amenity, each level storing only its overrides, with the effective value and its source visible in the UI.
- A Location Manager can manage Amenities and settings for assigned Locations but cannot rename, create, or deactivate a Location, nor reach Account settings.
- Amenities carry photos, per-weekday availability, booking mode, capacity, and fees, inheriting policy from the Location.
- Every new route is covered by cross-account and cross-location authorization tests.
- Every new UI string exists in Spanish and English.
