# M4 Roadmap: CSV Import for Registry

## Goal

M4 makes onboarding practical for real buildings by letting managers upload a CSV for Units, Residents, and Unit Memberships, review validation results before anything is written, and confirm a queued commit only after the data is safe.

The main risk is allowing imported registry data to bypass the domain invariants built in M3. Treat M4 as a validation-preview and authorization milestone first, then add the minimum frontend needed to make upload, review, and confirm usable.

## Current Starting Point

Already present from M3:

- Account, Location, Unit, Resident, Unit Membership, and Vehicle domain models.
- Registry status and Resident type enums.
- PostgreSQL constraints for Unit uniqueness, Resident portal links, active Primary Contact uniqueness, and Account/Location/Unit scope alignment.
- `AccessAuthorizationService` and policies for registry management.
- Manager APIs for Units, Residents, Unit Memberships, and Vehicles.
- Registry activity logging for Unit, Resident, Membership, Vehicle, Resident Invitation, Portal phone, and Export events.
- Queued CSV export foundation with tracked records, status transitions, storage-backed files, and activity events.
- Admin Registry frontend pages for Units, Residents, and Vehicles using TanStack Router search params, TanStack Query, Mantine drawers, React Hook Form, Zod, and Spanish i18n.

Still missing for M4:

- Import tracking tables, models, factories, enums, policies, and resources.
- Upload endpoint for registry CSV files.
- CSV parser and normalization service.
- Queued validation job that stores row-level preview data without creating registry records.
- Preview APIs for valid rows, blocking errors, duplicates, and warnings.
- Confirm endpoint and queued commit job.
- Commit logic that creates Units, Residents, and Unit Memberships through the same invariants as manager CRUD.
- Failure visibility and retry behavior.
- Activity log entry on import completion.
- Admin frontend upload, import history, preview, and confirm UI.

## Implementation Strategy

Build M4 in vertical slices, but keep a hard boundary between validation and commit. Upload and validation may store files and row previews; only the confirm flow may create registry records.

Recommended order:

1. Import schema, enums, models, factories, and policy.
2. CSV parser, header contract, row normalization, and duplicate detection.
3. Upload API and queued validation job.
4. Preview/read APIs.
5. Confirm API and queued commit job.
6. Activity logging, failure recovery, and seeded acceptance coverage.
7. Frontend import workflow.
8. Final acceptance checks and roadmap handoff.

## Canonical Import Contract

M4 should support one import type:

- `registry_units_residents`

The import is Location-scoped. The CSV should not be allowed to select arbitrary Locations per row. Account Admin may import into any Location in the active Account; Location Manager may import only into Locations they can manage. Front Desk and Residents cannot import registry data.

### Canonical CSV Columns

Use Spanish-first headers for the template and UI. The parser may accept normalized aliases, but the canonical template should use these headings:

- `unidad`
- `edificio`
- `piso`
- `nombres`
- `apellidos`
- `telefono`
- `email`
- `tipo_residente`
- `contacto_principal`
- `estado_membresia`
- `notas_unidad`

Rules:

- `unidad` is required for every row.
- `edificio`, `piso`, and `notas_unidad` are optional Unit fields.
- A row with only Unit fields may create or reuse a Unit without creating a Resident.
- If any Resident field is present, `nombres`, `apellidos`, and `tipo_residente` are required.
- `tipo_residente` accepts the persisted enum values first: `owner`, `tenant`, `occupant`, `guest_resident`.
- `tipo_residente` may also accept Spanish aliases in the parser, but normalized preview data must store persisted enum values.
- `estado_membresia` defaults to `active` when omitted.
- `contacto_principal` accepts common truthy values such as `si`, `s`, `true`, `1`, `yes`.
- Empty strings should normalize to `null` before validation.
- The parser should handle UTF-8 BOM and comma or semicolon delimiters.

### Preview Semantics

Validation preview should classify rows without writing Units, Residents, or Memberships:

- `valid`: ready to commit.
- `error`: blocked by missing required values, invalid enum values, invalid email, too-long fields, or scope violations.
- `duplicate`: would duplicate an existing or in-file record in a way that should not be committed.
- `warning`: valid but deserves review, such as an existing Unit that will be reused.

Suggested duplicate rules:

- Existing Unit with same `location_id`, normalized `unit_number`, and normalized nullable `building_name`: warning and reuse, not an error.
- Repeated Unit-only row in the file: duplicate and skipped.
- Multiple Resident rows for the same Unit: valid, because a Unit can have multiple Residents.
- Existing Resident with the same email in the Account: warning and reuse only if the row can safely create a missing Membership; otherwise duplicate and skipped.
- Repeated Resident email in the same file: duplicate unless the normalized Unit target differs and the commit can create a distinct Membership.
- Existing active Membership for the same Resident and Unit: duplicate and skipped.
- More than one imported Primary Contact for the same Unit: error unless exactly one row is selected as Primary Contact before confirmation. M4 can require reupload instead of row editing.

Confirm should be allowed only when `error_rows` is zero. Duplicate rows are skipped; warning rows are committed according to their normalized action.

## Slice 1: Import Domain Model

Status: Done.

Add the backend foundation before parsing files.

Suggested tables:

`registry_imports`:

- `id`
- `account_id`
- `location_id`
- `requested_by_user_id`
- `import_type`
- `status`
- `original_filename`
- nullable `disk`
- nullable `path`
- `total_rows`
- `valid_rows`
- `error_rows`
- `duplicate_rows`
- `warning_rows`
- nullable `confirmed_at`
- nullable `completed_at`
- nullable `failed_at`
- nullable `failure_reason`
- timestamps

`registry_import_rows`:

- `id`
- `registry_import_id`
- `account_id`
- `location_id`
- `row_number`
- `status`
- `raw_data`
- `normalized_data`
- `errors`
- `warnings`
- nullable `duplicate_key`
- nullable `committed_unit_id`
- nullable `committed_resident_id`
- nullable `committed_unit_membership_id`
- timestamps

Enums:

- `ImportType`
  - `registry_units_residents`
- `ImportStatus`
  - `pending`
  - `processing`
  - `ready_for_review`
  - `failed`
  - `completed`
- `ImportRowStatus`
  - `valid`
  - `error`
  - `duplicate`
  - `warning`
  - `imported`
  - `skipped`

Suggested config:

- `config('wasiy.imports.disk')`
- `config('wasiy.imports.max_file_kb')`
- `config('wasiy.imports.max_rows')`
- `WASIY_IMPORT_DISK=local`
- `WASIY_IMPORT_MAX_FILE_KB=2048`
- `WASIY_IMPORT_MAX_ROWS=5000`

Policy:

- `RegistryImportPolicy::viewAny(Account $account, ?Location $location = null)`
- `RegistryImportPolicy::view(RegistryImport $import)`
- `RegistryImportPolicy::create(Location $location)`
- `RegistryImportPolicy::confirm(RegistryImport $import)`
- `RegistryImportPolicy::retry(RegistryImport $import)` if retry endpoints are included.

Policy semantics should mirror M3 registry management:

- Account Admin can create and view imports for any Location in their Account.
- Location Manager can create and view imports only for manageable Locations.
- Front Desk can view registry lookup data but cannot create, confirm, or retry imports.
- Resident users cannot access import endpoints.

### Slice 1 Tests

- Import model casts statuses, JSON row fields, and timestamps correctly.
- Import rows belong to one Import, Account, and Location.
- Policy allows Account Admin and Location Manager for manageable Locations.
- Policy denies Front Desk, Residents, and inaccessible Locations.
- Import counters default to zero.

### Implementation Handoff

- Status: Done
- Completed: 2026-06-21
- Summary: Added the registry import tracking foundation with Import, Import Row, import status/type enums, factories, API resources, import config, and policy authorization for Account Admin and Location Manager workflows.
- Changed areas: `apps/api/database/migrations/2026_06_14_000001_create_registry_imports_tables.php`, `apps/api/app/Enums`, `apps/api/app/Models/RegistryImport.php`, `RegistryImportRow.php`, `apps/api/app/Policies/RegistryImportPolicy.php`, `apps/api/app/Http/Resources/RegistryImportResource.php`, `RegistryImportRowResource.php`, `apps/api/database/factories`, `apps/api/config/wasiy.php`, `apps/api/.env.example`, `apps/api/tests/Feature/RegistryImportDomainModelTest.php`.
- Verification: Red step confirmed `RegistryImport` was missing; `./vendor/bin/sail artisan test tests/Feature/RegistryImportDomainModelTest.php` passed with 7 tests and 86 assertions; related registry/import/export/authorization tests passed with 34 tests and 194 assertions; full `./vendor/bin/sail artisan test` passed with 134 tests and 838 assertions; `./vendor/bin/sail pint --dirty --format agent` passed.
- Decisions: Imports are Location-scoped and require `canManageRegistry`, so Front Desk users cannot view or mutate import records in M4. Import rows have a composite foreign key back to their parent Import scope to prevent Account/Location drift. `registry_import_rows` stores nullable committed model ULIDs without foreign keys for now so Slice 1 does not change M3 Unit, Resident, or Membership delete behavior. API resources intentionally omit storage `disk` and `path`.
- Follow-up: Slice 2 can build the parser, normalizer, validator, and duplicate detector on top of `RegistryImport` and `RegistryImportRow`, storing row-level preview data without creating registry records.

## Slice 2: CSV Parser and Validation Service

Status: Not started.

Create a parser/normalizer service before adding controllers. Keep it framework-friendly but testable without HTTP.

Suggested classes:

- `App\Services\RegistryImports\RegistryCsvParser`
- `App\Services\RegistryImports\RegistryImportValidator`
- `App\Services\RegistryImports\RegistryImportDuplicateDetector`
- `App\Data\RegistryImports\ParsedRegistryImportRow` only if a small typed data object improves clarity.

Parser responsibilities:

- Read the stored CSV stream with `fgetcsv`.
- Detect comma or semicolon delimiter from the header row.
- Strip UTF-8 BOM from the first header.
- Normalize header labels to snake_case canonical names.
- Preserve raw cell data for preview.
- Normalize empty strings to `null`.
- Trim string fields.
- Validate max row count before writing all rows.

Validation responsibilities:

- Validate required columns.
- Validate required fields for Unit-only and Resident rows.
- Validate enum values and Spanish aliases.
- Validate email shape.
- Validate field length limits to match M3 requests and database columns.
- Validate that every target row belongs to the explicit import Location.
- Validate Primary Contact rules across existing data and in-file rows.
- Produce Spanish row-level messages suitable for the preview UI.

Duplicate detection responsibilities:

- Build stable keys for Unit, Resident, and Membership checks.
- Detect in-file duplicate Unit-only rows.
- Detect existing Units that should be reused with warnings.
- Detect existing Residents and Memberships according to the preview semantics above.
- Store enough normalized data for the commit job to avoid reparsing the original CSV.

Avoid using the manager HTTP controllers from the parser. Shared domain behavior can move into small actions only when it removes duplication without weakening tests.

### Slice 2 Tests

- Parser accepts canonical Spanish headings.
- Parser handles UTF-8 BOM.
- Parser detects comma and semicolon delimiters.
- Parser normalizes empty strings to `null`.
- Parser rejects unknown or missing required headings.
- Unit-only rows validate without Resident fields.
- Resident rows require names and Resident type.
- Spanish aliases normalize to enum values.
- Invalid enum, email, and too-long fields produce Spanish row errors.
- Duplicate detector distinguishes reusable existing Units from duplicate rows that must be skipped.
- Multiple Resident rows for one Unit are not treated as duplicate Units.

## Slice 3: Upload API and Validation Job

Status: Not started.

Add the upload endpoint and queue the validation work. No registry records should be created in this slice.

Suggested endpoint:

- `POST /api/locations/{location}/registry-imports`

Request:

- multipart `file`
- `import_type=registry_units_residents`

Behavior:

- Authorize `RegistryImportPolicy::create` for the route Location.
- Validate file with Laravel file validation rules: CSV/text MIME types, configured max size.
- Store the raw CSV on `config('wasiy.imports.disk')`.
- Create a `registry_imports` row with `pending` status.
- Dispatch `ValidateRegistryImport`.
- Return `201` with `RegistryImportResource`.

Suggested job:

- `ValidateRegistryImport`

Job behavior:

- Ignore imports that are no longer `pending`.
- Move `pending` to `processing`.
- Parse the stored file.
- Replace any previous row preview for the import if this is a retry.
- Insert row preview records.
- Update counters.
- Move to `ready_for_review` when parsing completes.
- Move to `failed` with `failure_reason` when the file cannot be parsed or storage is unavailable.

Use the existing export job pattern for status transitions and direct job testing. Use `Storage::fake` and `Queue::fake` in feature tests.

### Slice 3 Tests

- Manager can upload a CSV for an accessible Location.
- Upload stores the file and creates a pending import.
- Upload dispatches `ValidateRegistryImport`.
- Manager cannot upload for an inaccessible Location.
- Front Desk cannot upload.
- Invalid file type or oversized file returns validation errors.
- Validation job transitions pending to ready_for_review and writes counters.
- Validation job stores row-level errors without creating Units, Residents, or Memberships.
- Validation job marks import failed when storage read fails or parser throws.

## Slice 4: Preview and Import Read APIs

Status: Not started.

Add APIs that let the frontend show import history and inspect preview rows.

Suggested endpoints:

- `GET /api/registry-imports`
- `GET /api/registry-imports/{import}`
- `GET /api/registry-imports/{import}/rows`

List filters:

- `account_id`
- nullable `location_id`
- nullable `status`
- nullable `import_type`
- `page`
- `per_page`

Row filters:

- nullable `status`
- nullable `search`
- `page`
- `per_page`

Resource shape should include:

- Import identifiers, scope, actor, filename, type, status, counters, timestamps, and failure reason.
- Row number, status, raw data, normalized data, errors, warnings, duplicate key, and committed IDs.

Authorization:

- Account Admin can list Account-wide or by Location.
- Location Manager list must be constrained to accessible manageable Locations.
- Import detail and rows must authorize the concrete Import.

### Slice 4 Tests

- Account Admin can list Account imports and filter by Location/status.
- Location Manager sees only imports for manageable Locations.
- Import detail is denied for inaccessible Location.
- Row list supports status filtering and pagination.
- Preview resources expose errors and warnings without exposing storage paths.

## Slice 5: Confirm API and Commit Job

Status: Not started.

Add the confirm flow and queued commit. This is the first slice that writes registry records.

Suggested endpoint:

- `POST /api/registry-imports/{import}/confirm`

Confirm behavior:

- Authorize `RegistryImportPolicy::confirm`.
- Allow confirmation only from `ready_for_review`.
- Reject confirmation when `error_rows > 0`.
- Store `confirmed_at`.
- Dispatch `CommitRegistryImport`.
- Return the updated resource.

Suggested job:

- `CommitRegistryImport`

Commit behavior:

- Move the import from `ready_for_review` to `processing`.
- Process only `valid` and `warning` rows.
- Skip `duplicate` rows and mark them `skipped`.
- Use a database transaction around each logical row or small chunk; do not allow a partial row commit.
- Create or reuse Unit by Location, Unit number, and nullable Building name.
- Create or reuse Resident according to the normalized duplicate decision.
- Create Unit Membership when a Resident row is present and a Membership does not already exist.
- Apply Primary Contact changes through `UnitMembership::markAsPrimaryContact()` so existing invariants stay centralized.
- Store committed model IDs on the row.
- Move rows to `imported` or `skipped`.
- Move Import to `completed` when all committable rows are processed.
- Move Import to `failed` with `failure_reason` if commit fails unexpectedly.

The commit job should use the same Account and Location IDs from the Import record. It should never trust Location data from row content.

### Slice 5 Tests

- Confirm rejects imports that are not ready_for_review.
- Confirm rejects imports with blocking error rows.
- Confirm dispatches `CommitRegistryImport`.
- Commit creates Units from Unit-only rows.
- Commit creates Residents and Memberships from Resident rows.
- Commit reuses existing Units in the import Location.
- Commit skips duplicate rows.
- Commit cannot create records in unauthorized or mismatched Locations.
- Primary Contact changes use the same invariant as manager CRUD.
- Failed commit is visible on the Import record.

## Slice 6: Activity Logging and Failure Recovery

Status: Not started.

Extend the activity log with import completion and failure visibility.

Suggested event types:

- `import.uploaded`
- `import.validation_failed`
- `import.completed`
- `import.failed`

The M4 acceptance criteria only requires completion activity, but upload and failure events are useful if they stay compact and follow the export event pattern.

Activity metadata should include:

- `import_id`
- `import_type`
- `filename`
- `location_id`
- `total_rows`
- `valid_rows`
- `error_rows`
- `duplicate_rows`
- `warning_rows`
- `created_unit_ids` count or IDs when small
- `created_resident_ids` count or IDs when small
- `created_unit_membership_ids` count or IDs when small
- `actor_user_id`

Failure recovery:

- A failed validation import can be retried if the stored file still exists.
- A failed commit import can be retried only from a safe failed phase. If partial row commits are possible, retry must be idempotent based on committed row IDs and duplicate checks.
- M4 can keep recovery simple by making each row commit idempotent and exposing `POST /api/registry-imports/{import}/retry`.

Suggested retry endpoint:

- `POST /api/registry-imports/{import}/retry`

If retry complexity becomes too large, defer retry endpoint and satisfy recoverability with visible `failed` status, failure reason, and reupload flow. Do not hide failed imports.

### Slice 6 Tests

- Completed import logs an activity row with Spanish summary and counters.
- Failed validation logs or exposes failure reason.
- Failed commit logs or exposes failure reason.
- Retry of failed validation requeues validation and clears stale failure fields.
- Retry of failed commit does not duplicate already committed rows if implemented.
- No activity log is created for a no-op retry that does not run.

## Slice 7: Frontend Import Workflow

Status: Not started.

Add an admin Registry import workflow that fits the existing frontend structure.

Suggested route:

- `/admin/registry/imports`

Suggested feature folder:

- `apps/web/src/features/imports`

Core UI:

- Import history table with filename, Location, status, counters, requested date, completed date, and failure reason.
- Upload drawer or modal using Mantine Dropzone.
- Import detail/preview view with tabs or segmented control for:
  - Todos
  - Validos
  - Errores
  - Duplicados
  - Advertencias
- Row preview table with row number, Unit, Resident, status, errors, and warnings.
- Confirm button enabled only when status is `ready_for_review` and `error_rows` is zero.
- Clear Spanish empty, loading, failed, and success states.

Navigation:

- Add `Importaciones` under the Registry navigation group for Account Admin and Location Manager.
- Keep Units, Residents, and Vehicles pages focused on their current CRUD workflows.
- A secondary `Importar CSV` action can link from Units/Residents pages to the Import route if it stays simple.

Frontend API helpers:

- `createRegistryImport(locationId, file, importType)`
- `getRegistryImports(search)`
- `getRegistryImport(importId)`
- `getRegistryImportRows(importId, search)`
- `confirmRegistryImport(importId)`
- `retryRegistryImport(importId)` if backend retry exists.

Testing:

- API helper tests should assert multipart upload URL and list/row query params.
- Component tests should cover upload success, preview error rendering, disabled confirm with errors, enabled confirm with warnings only, and query invalidation after confirm.
- Build should still pass with the existing large chunk warning.

### Slice 7 Tests

- Registry navigation shows Importaciones for Account Admin and Location Manager.
- Upload sends multipart file to the Location-scoped endpoint.
- Import history renders counters and statuses.
- Preview filters rows by status.
- Confirm is disabled when errors exist.
- Confirm mutation invalidates import detail, import rows, Units, and Residents queries.
- Spanish copy comes from i18n files.

## Slice 8: Seed Scenarios and Final Acceptance

Status: Not started.

Add enough seeded or test fixture coverage to manually verify imports without crafting data from scratch every time.

Suggested acceptance fixture:

- One existing Unit in `edificio-central`.
- One existing Resident with email.
- One CSV sample with:
  - one new Unit-only row;
  - one new Resident and Membership row;
  - one row reusing an existing Unit;
  - one duplicate Membership row;
  - one invalid row missing `unidad`;
  - one Primary Contact row.

Final M4 acceptance checks:

- Manager can upload CSV and see validation preview before records are created.
- Invalid rows are clearly shown in Spanish.
- Duplicate rows are clearly separated from blocking errors.
- Warning rows can be reviewed before confirmation.
- Confirmed import creates Units, Residents, and Unit Memberships.
- Import reuses existing Units in the target Location instead of creating duplicates.
- Import cannot create records across unauthorized Locations.
- Import failure is visible through status and failure reason.
- Completed import logs activity.
- Frontend upload, preview, and confirm workflow works for Account Admin and Location Manager.

### Slice 8 Tests

- Seeder or fixture test covers the sample import lifecycle.
- Full backend focused import suite passes.
- Related registry, authorization, and activity tests still pass.
- Frontend import tests pass.
- `pnpm --filter @wasiy/web lint` passes.
- `pnpm --filter @wasiy/web build` passes.

## Suggested Pull Request Breakdown

1. Import schema, enums, models, factories, resources, and policy.
2. Parser, normalizer, validation, and duplicate detection services.
3. Upload endpoint and validation job.
4. Import history/detail/row preview APIs.
5. Confirm endpoint and commit job.
6. Activity logging, failure visibility, retry decision, and acceptance fixtures.
7. Frontend import route, upload drawer, preview table, and confirm flow.
8. Final acceptance pass and roadmap handoff updates.

## Definition of Done

M4 is done when the product can correctly answer these questions from backend-owned data:

- Which CSV file did this Manager upload, for which Account and Location, and who uploaded it?
- Is the import pending, processing, ready for review, failed, or completed?
- Which rows are valid, invalid, duplicate, or warnings?
- Why is each invalid row blocked, in Spanish?
- Which existing Units, Residents, or Memberships would be reused or skipped?
- Has confirmation happened, and who is allowed to confirm it?
- Which Units, Residents, and Unit Memberships were created after confirmation?
- Can a Location Manager import only into their manageable Locations?
- Is an import failure visible and recoverable through retry or reupload?
- Was completion captured in the Activity Log?
