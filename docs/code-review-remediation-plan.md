# Code Review Remediation Plan

**Date:** 2026-08-15
**Source:** [thermo-nuclear-review-2026-08-15.md](./thermo-nuclear-review-2026-08-15.md)
**Estimated total effort:** 6–9 working days, front-loaded — Waves 1–2 plus the registry consolidation (~3 days) capture most of the value.

Work is organized into four PR waves. Each wave is independently shippable, ordered so that correctness fixes land before refactors and tests land before the code they protect. Per-wave verification: `php artisan test` (or `pnpm test:api`) and `pnpm lint:web` + vitest.

---

## Wave 1 — Merge blockers (~0.5 day, low risk, one PR)

Five isolated functional bugs. No refactoring in this wave — smallest possible diffs.

### 1.1 Resident claim race check
- **File:** `apps/api/app/Actions/Residents/ClaimResidentInvitation.php:24-32`
- **Change:** After the `lockForUpdate` refetch, assert `status === UserInvitationStatus::Pending` and reject otherwise, mirroring `AcceptStaffInvitation.php:38-44` (use the flow's existing `ValidationException` idiom for now; dialect unification comes in Wave 4).
- **Test first:** feature test — claim an invitation that was cancelled after token resolution; assert rejection and that no password reset occurs for an existing user.

### 1.2 Untranslated validation errors in registry forms
- **Files:** `residents-registry-page.tsx:239-260`, `units-registry-page.tsx:213`, `vehicles-registry-page.tsx:250`
- **Change:** Translate `fieldState.error.message` before display. Prefer a shared `useFieldError(t)` helper (or errorMap in the zodResolver) so Wave 3's `RegistryCrudPage` inherits it; minimal version is wrapping each `error={...}` in `t(...)`.
- **Test:** vitest — submit an empty drawer form, assert the rendered error is the translated string, not the key.

### 1.3 Front-desk default route lands on 404
- **File:** new `apps/web/src/routes/_authenticated/front-desk/index.tsx`
- **Change:** Add an index route rendering the existing `PagePlaceholder`, so `getDefaultAuthenticatedRoute` → `/front-desk` resolves.
- **Test:** route test — front-desk-only session lands on the placeholder, not not-found.

### 1.4 Missing gate on portal vehicle creation
- **Files:** `apps/api/app/Http/Controllers/Api/VehicleController.php:181-208, :395`, `apps/api/app/Policies/VehiclePolicy.php`
- **Change:** Add `VehiclePolicy::createAsResident(User, Unit)`; call `Gate::authorize` at the top of `portalStore`; remove the membership check from `validatePortalVehiclePayload`.
- **Test first:** feature test — resident without membership in the target unit gets 403 on `POST /portal/vehicles`.

### 1.5 Atomic job claiming
- **Files:** `CommitRegistryImport.php:35-43`, `ValidateRegistryImport.php:43-51`, `GenerateCsvExport.php:32-40`
- **Change:** Replace read-status-then-`forceFill` with a conditional claim: `Model::whereKey($id)->where('status', $expected)->update([...Processing]) === 1`, else return.
- **Test:** unit test per job — a job whose record is already `Processing` (or otherwise ineligible) exits without side effects.

---

## Wave 2 — Import pipeline atomicity + performance (~1 day, one PR)

Changes failure behavior of the import/export pipeline. **Write the partial-failure feature tests before touching the code.**

### 2.1 Transactional import/export creation
- **Files:** `RegistryImportController.php:102-139`, `RegistryExportController.php:97-126`
- **Change:** Store the file first (keyed by a pre-generated ULID), then create the record with `path` set inside one `DB::transaction` with the activity log; dispatch after commit. A storage failure must leave no DB row.
- **Test:** simulate storage failure; assert no stranded `Pending` row with `path = null`.

### 2.2 All-or-nothing commit
- **File:** `CommitRegistryImport.php:45-61`
- **Change:** Replace per-row transactions with one wrapping transaction (rows are capped at 5,000 — safe). Replace the `&`-captured ID arrays with `commitRow()` returning a small result object collected via `map()`.
- **Test:** import where row N fails validation mid-commit; assert zero rows persisted and the failure metadata is coherent.

### 2.3 Batch the duplicate detector
- **File:** `RegistryImportDuplicateDetector.php:25-41`
- **Change:** Preload the location's units keyed by `unitKey` and residents keyed by lowered email into maps before the loop; one batched membership-exists query. Eliminates up to ~10,000 queries per 5,000-row import.
- **Test:** existing detector tests must pass unchanged; add a query-count assertion.

---

## Wave 3 — The big deduplications (~3–5 days, several PRs)

Each item deletes a family of review findings at once. Ship as separate PRs in the order below.

### 3.1 Web registry consolidation (~1.5–2 days) — PR per step
1. **Extract verbatim components** (zero risk): move `RegistryTable<T>` to `features/registry/registry-table.tsx`; hoist `RegistryHeader`/`RegistryFilters` out of units; make `NullableTextInput` generic over `Path<T>`; add `submitHandlingServerErrors(form, fn)` in `lib/errors.ts` and use it at all six call sites. Vehicles and residents pick up the query-error `Alert` for free — this closes the drift bug.
2. **Extract shared hooks/helpers:** `useActiveUnitOptions(location)` (owns the `per_page: 100` cap in one place), `formatUnitLabel(unit)`, `statusOptions(t)`.
3. **`useRegistryCrud` + `RegistryCrudPage`:** generic hook owning query/mutation/drawer/form/search plumbing; shell component taking `columns`, `renderFormFields`, `extraFilters`. Convert one page per commit — units first (most complete), then vehicles, then residents. Target: each page ~120 lines of entity config; net ≈ −450 lines.
4. **Guard-component split:** thin outer component resolves `location`/`account` and early-returns the alert; inner component receives them non-null. Deletes every `?.`, `?? ''`, `enabled:` flag and the `as File` cast.
- **Safety net:** existing page tests; add a smoke test per converted page before converting it if coverage is thin.

### 3.2 Invitation issuance (~0.5 day)
- **Files:** `InviteStaffUser.php:59-108`, `InviteResidentUser.php:67-111`, `ResendUserInvitation.php:44-55`, `UserInvitationPurpose` enum, `DatabaseSeeder.php:340/363`
- **Change:** Add `UserInvitationPurpose::expiresDays(): int` and `notification(UserInvitation, string $token)`; extract `IssueUserInvitation::issue(purpose, account, email, attributes, invitedBy): [UserInvitation, string]` covering expire-stale → create-with-hash → catch-unique → notify. Drop the redundant `exists()` pre-checks (the unique-constraint catch is the real guard). Actions keep only eligibility checks + `issue()` + their own activity log. Seeder uses `expiresDays()` instead of raw config keys.
- **Safety net:** existing invitation flow tests (good coverage per review).

### 3.3 Import pipeline row DTO (~1 day)
- **Files:** `Services/RegistryImports/*`, `CommitRegistryImport.php`, `ValidateRegistryImport.php`
- **Change:**
  - `NormalizedRegistryRow` DTO with typed properties (`?ResidentType`, `?bool is_primary_contact`, …), `isResidentRow(): bool`, `unitKey(): string` — replaces the three copy-pasted predicates and two key-builders.
  - Normalizers return real types; validation errors recorded at normalization time (kills the `bool|string` smuggling in `RegistryImportValidator.php:105-150` and its re-check branches).
  - Shared `RegistryRecordFinder` (or scopes `Unit::matchingImportKey`, `Resident::matchingEmail`, `UnitMembership::activeFor`) used by both detector and commit job, so preview and commit can never disagree on matching.
  - Cleanups riding along: drop the unused `$location` param in `RegistryImportValidator::validate`; enum comparison instead of `->value === 'error'` (`:170`); `activityMetadata()` moves to the `RegistryImport` model; `statusCounts()` → `countBy`.
- **Test:** full pipeline feature test (upload → validate → confirm) green before and after.

### 3.4 API controller plumbing (~1 day, mechanical — split into small PRs)
- `Unit::label()` accessor → delete five `unitLabel()` copies (four controllers + `AccessContextService:278`).
- `scopeSearch(array $columns, string $term)` (owns the `addcslashes` LIKE-escaping) → five call sites become one line.
- `SortParser::apply(Builder, ?string, array $allowed, string $default)` → replaces duplicated `applySort` in Vehicle/Unit controllers.
- `PaginatedListRequest` base FormRequest (page/per_page rules, max 100) → seven endpoints.
- `CreateUnitMembership` action → used by both `UnitMembershipController::store` and `ResidentController::createMembership`; shared `logMembershipActivity` goes with it.
- Split `PortalVehicleController` out of `VehicleController` (routes already segregate `/portal/vehicles`); collapse shared write logic into a `VehicleWriter` action; delete the dead `forceFill` at `VehicleController.php:104-112`.
- Import state transitions (`confirm`/`retry` rules from `RegistryImportController.php:186-236`) move onto the model/actions.

### 3.5 Surface route factory (~1–2 hours)
- `surfaceRouteOptions(surface, Layout)` factory + `surfaceAccess: Record<Surface, predicate>` map in access.ts; the three 28-line route files drop to ~5 lines each.
- Delete `admin-layout.tsx` and `front-desk-layout.tsx` (pure pass-throughs) and their directories; routes use `AppShell` directly.
- Replace `getAvailableNavigationItems`'s if-chain and redundant access re-checks with a `Record<Surface, NavEntries>` lookup + `filterNavigationEntries` — guards remain the single enforcement point.

---

## Wave 4 — Structural cleanups (~1–2 days, trickle in as standalone PRs)

Ordered roughly by value; none are urgent.

1. **Liveness centralization** in `AccessAuthorizationService`: one `isLive()` / `Location::scopeLive()`; `canAccessAccount` delegates to `accessibleAccounts()`; `registryRecordLocationMatches` and `locationAccountExists` collapse. Add `canManageAnyRegistryInAccount(User, Account)` as a single query, replacing the per-location fan-out duplicated in `ResidentPolicy::createInAccount` and `RegistryImportPolicy::viewAny`. Hoist the admin fast-path in `manageableInvitationLocationForResident`.
2. **`AccessContext` DTO/resource** replacing the untyped array from `AccessContextService::resolve()`; split session repair (forget/put) out of resolution; move the "active account still valid" invariant from `AccessContextController::selectLocation` into the service; delete `selectAccount`'s dead single-location auto-pick.
3. **FormRequests replace `$partial` mode-flag validators** (Vehicle/UnitMembership/Resident controllers) with a shared `AssignableUnit` rule; move `authorizeResidentAccess` into `ResidentPolicy` so route-level `->can()` works.
4. **Exception dialect unification:** domain exceptions in Actions, mapped to HTTP in the handler; extract shared `createUserFromInvitation`; align the twin accept flows.
5. **File splits:** `imports-registry-page.tsx` → `UploadDrawer` / `ImportDetailPanel` / `ImportRowsSection` (~80-line page); `access.ts` → predicates stay, nav spec/content to `features/navigation/`; `DatabaseSeeder` → composed `DemoAccountsSeeder`/`DemoRegistrySeeder`/`DemoInvitationsSeeder`.
6. **Job lifecycle trait** (`RunsTrackedJob` or model methods `markProcessing/markCompleted/markFailed`) replacing the triplicated Processing→Completed/Failed scaffolding; delete the `handle(?Dep = null)` + `??=` boilerplate (queue method injection handles it).
7. **Registry search schema:** one zod schema with `.coerce`/`.catch` per route (vehicles extends it); delete `normalizedRegistrySearch` and the copy-pasted `validateSearch` objects.
8. **Small items:** i18n key-parity vitest; decide on the unreachable `en` locale (wire a switcher or mark aspirational); `lib/dates.ts` derives locale from i18n and accepts location timezone; `markAsPrimaryContact` renamed or side-effect dropped; invitation-page `FormTextInput`/`FormPasswordInput` extraction; status-badge ternaries → `Record<Status, color>`; `PortalResidentController` prohibited-rules trimmed to `phone` alone; `location-switcher` fallback rule moved next to `getDefaultLocation` or replaced with a select prompt; delete speculative props (`showNotifications`, `Brand.productAreaKey`); `wouldGrantAccess()` pre-query removed in favor of inspecting `sync()`'s change-set; group `routes/api.php` by access model; JSON response hand-wrapping in invitation controllers replaced with Resource machinery; `buildParams()` helper for the hand-rolled `URLSearchParams` chains.

---

## Do not touch (verified sound in the review)

Preserve through every refactor: the route-guard architecture in `guards.ts`; the nav-spec `visibleTo` predicate tree design; invitation token hygiene (sha256-only, purpose-scoped resolution); `lockForUpdate` discipline in staff mutations including the last-admin lock; `api-client`/`query-client` setup; the staff/invitation Actions layer (it is the template Wave 3.4 converges toward); the 404-before-403 anti-enumeration ordering in invitation controllers; the staff invitation page's `CreateAccountMode`/`ConfirmJoinMode` split (genuine mode fork — do not merge with the resident page).

## Sequencing rules

- Waves in order; within Wave 3, PRs 3.1–3.5 are independent and can parallelize.
- Tests that protect a refactor land before the refactor (explicitly: 1.1, 1.4, 2.1, 2.2).
- One concern per PR in Waves 3–4 — the mechanical dedups touch many files and review best in small diffs.
- Re-run the thermo-nuclear review (`/thermo-nuclear-code-review`) after Wave 3 to confirm the duplication findings are closed and catch regressions.
