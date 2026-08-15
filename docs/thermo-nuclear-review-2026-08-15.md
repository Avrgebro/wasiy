# Thermo-Nuclear Code Review — `stage` (full codebase)

**Date:** 2026-08-15
**Scope:** Entire `stage` branch (`main` is empty). Four parallel review passes: API controllers/routes, API services/actions/jobs/models, web feature modules, web routing/layout/shared components.

## Verdict: REQUEST CHANGES

The architecture bones are good — thin policies delegating to a real authorization service, a proper Actions layer for staff/invitations, centralized route guards, exact i18n key parity, no `any`/`@ts-ignore` anywhere in app code. But the codebase fails the review on systematic copy-paste: the same logic is hand-maintained in 3–5 places across at least eight distinct axes (registry pages, unit labels, search escaping, invitation issuance, row predicates, liveness guards, job lifecycles, surface routes). Several of those have **already diverged** — the vehicles/residents pages silently lost the error alert that units has, and the resident invitation claim flow is missing a concurrency re-check its staff twin explicitly documents. That is the failure mode duplication guarantees, and it's already shipping. Two functional landmines round it out: registry drawer forms show raw i18n keys to users, and front-desk users' default landing page is a 404.

---

## Findings

### 1. Structural regressions (divergence that already happened)

**`apps/api/app/Actions/Residents/ClaimResidentInvitation.php:24-32` — BLOCKER.** The staff twin (`AcceptStaffInvitation.php:38-44`) re-checks `status === Pending` after the `lockForUpdate` refetch, with a comment explaining the race. The resident flow refetches under lock but never re-checks status — a cancel or second claim committed between token resolution and the transaction gets silently overwritten to `Accepted`, and an existing user's password is reset again. One line fixes it: assert `Pending` after the locked refetch, mirroring the staff flow.

**`apps/web/src/features/vehicles/vehicles-registry-page.tsx` / `residents-registry-page.tsx` — MAJOR.** Units extracted `RegistryHeader`/`RegistryFilters` locally and renders a query-error `Alert` (`units-registry-page.tsx:178-182`); vehicles and residents re-inline the same JSX and render **no error state at all** for their list queries. This is copy-paste drift in action — the abstraction was half-built and its siblings never caught up.

**`apps/web/src/routes/_authenticated/front-desk/route.tsx` — MAJOR.** The front-desk directory has no index child, but the nav spec and `getDefaultAuthenticatedRoute` (`access.ts:110`) both send front-desk users to `/front-desk` — whose `<Outlet />` matches nothing. A front-desk-only user's default landing page is the not-found fallback. Add a `PagePlaceholder` index route (the pattern already exists) or don't ship the surface scaffolding yet.

**`apps/api/app/Http/Controllers/Api/VehicleController.php:181-208` — MAJOR.** `portalStore` has no `Gate::authorize` at all — its only guard is a membership check buried inside `validatePortalVehiclePayload` (line 395), while its siblings `portalUpdate`/`portalDestroy` call gates properly. Authorization hidden in a validator is invisible to a gate-layer audit and dies the first time someone simplifies the validator. Move it to `VehiclePolicy::createAsResident`.

**Registry form validation errors are shown untranslated — MAJOR, user-visible.** The zod schemas store i18n keys as messages, and login/invitation pages correctly render `t(fieldState.error.message)` — but all three registry drawer forms pass the raw key (`residents-registry-page.tsx:239-260`, `units:213`, `vehicles:250`). Users literally see `validation.firstNameRequired`. Fix once with a shared `FormTextInput`/`useFieldError` or a custom zodResolver errorMap.

### 2. Missed simplifications (the big deletions)

**The three registry CRUD pages are ~70% the same file — BLOCKER.** `units-registry-page.tsx` (367), `vehicles-registry-page.tsx` (361), `residents-registry-page.tsx` (350): identical query/mutation/drawer/form/search/pagination scaffolding, a **verbatim-copied `RegistryTable<T>` component in all three** (`units:312-341`, `vehicles:306-335`, `residents:321-350`), a duplicated `NullableTextInput`, and the same try/catch → `applyLaravelValidationErrors` block repeated six times across the app. The judo move, in order of risk:

1. Move `RegistryTable` to `features/registry/registry-table.tsx` as-is — zero-risk, deletes ~60 lines today.
2. Extract `useRegistryCrud({queryKey, fetch, create, update, schema, defaults})` owning query/mutation/drawer/form/search plumbing, plus a `RegistryCrudPage` shell taking `columns` and `renderFormFields`. Each page collapses to ~120 lines of entity config. Net ≈ −450 lines, and the error-alert divergence gets fixed structurally.

Every new registry entity currently costs a 360-line clone; after this it costs a config object.

**Invitation issuance is written three times — MAJOR.** `InviteStaffUser.php:59-108`, `InviteResidentUser.php:67-111`, and `ResendUserInvitation.php:44-55` (complete with `$isStaff` ternaries) each hand-roll the same sequence: expire stale pendings → live-pending check → `Str::random(64)` → config-keyed expiry → create with sha256 hash → catch unique-violation → notify. Put `expiresDays()` and `notification()` on the `UserInvitationPurpose` enum and extract one `IssueUserInvitation::issue(...)`. Each action shrinks to eligibility checks + one call, the resend ternaries vanish, and `DatabaseSeeder.php:340/363` stops needing raw config keys. Bonus deletion: the `exists()` pre-check duplicates what the unique-constraint catch already guarantees — drop it and a whole branch disappears from both actions.

**`unitLabel()` exists in six places across two languages — MAJOR.** PHP: copy-pasted in four controllers (`VehicleController:450`, `ResidentController:361`, `UnitMembershipController:241`, `UnitController:235`) plus a variant in `AccessContextService:278`. TS: the same `[building_name, unit_number].filter(Boolean).join(...)` computed in five components. One `Unit::label()` accessor and one `formatUnitLabel(unit)` helper delete all of it.

**`ResidentController::createMembership` (`:251-289`) hand-copies `UnitMembershipController::store` (`:38-75`) — MAJOR** — same transaction body, same activity events, and they've already diverged subtly on `status`/`is_primary_contact` handling. Extract a `CreateUnitMembership` action (the Actions layer is right there and used correctly elsewhere). The verbatim-duplicated `logMembershipActivity` helpers go with it.

**The three surface route files are 25/28 lines identical — MAJOR.** `routes/_authenticated/{admin,front-desk,portal}/route.tsx` differ in exactly three substitution points (surface string, access predicate, layout). A `surfaceRouteOptions(surface, Layout)` factory drops each to ~5 lines. And `admin-layout.tsx`/`front-desk-layout.tsx` are pure pass-throughs to `AppShell` — delete both files and their directories.

### 3. Branching complexity

**`AccessAuthorizationService.php` — MAJOR.** Two problems in one file. First, soft-delete liveness guards are sprinkled through in three inconsistent idioms (`trashed()` checks, a per-call `locationAccountExists()` query, `whereHas` on query paths) — one request path re-checks liveness three times, and every new method must remember to re-add the right guards or it silently authorizes against dead tenants. Centralize into one `isLive()` / `Location::scopeLive()`. Second, `canAccessAccount()` (`:66-81`) re-implements the membership rule that `accessibleAccounts()` (`:24-37`) already encodes — two hand-synced encodings of "who can access an account." Make it `accessibleAccounts($user)->whereKey($account->id)->exists()`.

**Import state machine lives in controller conditionals — MAJOR.** `RegistryImportController.php:186-236`: `confirm`/`retry` encode transition rules ("only ReadyForReview confirms", "only Failed retries") as inline `ValidationException` throws. Move to the model/actions so jobs and future CLI entry points share them.

**`getAvailableNavigationItems` (`access.ts:266-284`) double-enforces access — MAJOR.** Every caller sits behind a `beforeLoad` guard running the same predicate, so the `: []` arms are unreachable and readers must prove two enforcement points agree. Replace with a `Record<Surface, NavEntries>` lookup + `filterNavigationEntries`; guards stay the single enforcement point.

**`RegistryImportValidator.php:105-150` — MAJOR.** `normalizeBoolean(): bool|string` returns the *invalid raw string* so a later branch can re-detect it — which is why `normalized_data` is `array<string, mixed>` everywhere and `is_primary_contact` is `bool|string|null` at every consumption site. Normalize to real types, record the error at normalization time, and three re-check branches disappear.

### 4. Abstraction and type problems

**The import pipeline passes `array<string, mixed>` through four stages — MAJOR.** The `isResidentRow` predicate is copy-pasted verbatim in three classes (`CommitRegistryImport:294`, `RegistryImportValidator:95`, `RegistryImportDuplicateDetector:110`) and `unitKey()` in two (`Validator:192`, `Detector:127`). A typed `NormalizedRegistryRow` DTO with `isResidentRow()` and `unitKey()` collapses five duplicates into two methods and gives the whole pipeline a spine.

**Detector and commit job re-implement each other's matching queries — MAJOR.** `CommitRegistryImport:195-278` vs `RegistryImportDuplicateDetector:75-108`: the same unit/resident/membership lookups, duplicated. If the match rule changes, preview and commit disagree — a row previewed as "will reuse existing unit" can create a new one. Extract a shared `RegistryRecordFinder` or Eloquent scopes.

**`AccessContextService::resolve()` (`:26-92`) — MAJOR.** Returns an untyped nested array blob that is effectively the app-shell contract, and mutates the session (forget/put) inside a method named like a read. Return an `AccessContext` DTO/resource; split session repair out of resolution.

**Dual-personality inline validators — MAJOR.** `$partial ? 'sometimes' : 'required'` mode-flag validators in `VehicleController:345-402`, `UnitMembershipController:183-207`, `ResidentController:207-226`, while `StoreUnitRequest`/`UpdateUnitRequest` demonstrate the intended FormRequest pattern in the same codebase. Per-resource Store/Update FormRequests kill the flags, and the three near-identical "selected unit is not manageable" after-hooks become one shared `AssignableUnit` rule.

**`ResidentController::authorizeResidentAccess` (`:291-306`) — MAJOR.** A hand-rolled policy (admin bypass + location walk + `mutate:` mode flag) living in the controller while `ResidentPolicy` exists. Move it into the policy; the mode flag dies and route-level `->can()` becomes possible.

### 5. Atomicity

**All three jobs claim work non-atomically — MAJOR.** `CommitRegistryImport:35-43`, `ValidateRegistryImport:43-51`, `GenerateCsvExport:32-40` read status then `forceFill(Processing)->save()` — two workers can both pass the guard and both commit rows. Fix is one line each: conditional `->where('status', ...)->update(...) === 1` claim.

**`CommitRegistryImport:45-61` — MAJOR.** Per-row transactions with no overall story: a failure at row 500 leaves rows 1–499 committed, the import marked `Failed`, and the created-IDs log never written. At ≤5,000 rows, one wrapping transaction is safe and simpler.

**`RegistryImportController::store` (`:102-139`) — MAJOR.** create-row → file upload → path save → log → dispatch with no transaction or cleanup; a storage failure strands a `Pending` import with `path = null`. Every other controller wraps write+log; this one and `RegistryExportController::store` are the exceptions.

**`RegistryImportDuplicateDetector:25-41` — MAJOR (performance, same family).** Per-row `existingUnit()`/`existingResident()` queries: up to 10,000 queries per 5,000-row import. Preload two keyed maps before the loop. Same shape in `manageableInvitationLocationForResident` (`AccessAuthorizationService:154-181`, N×3 queries per candidate location) and the duplicated per-location policy fan-out in `ResidentPolicy::createInAccount` / `RegistryImportPolicy::viewAny`.

### 6. File-size and modularity

- **`VehicleController.php` (454 lines) — BLOCKER-adjacent.** Two products in one file: staff CRUD + a parallel `portal*` CRUD with near-identical bodies. Split `PortalVehicleController` out (routes already segregate `/portal/vehicles`) and collapse the shared write logic into one action; ~150 lines and the whole `portal*` family disappear from this file.
- **`imports-registry-page.tsx` (538 lines) — MAJOR.** Page + 3 queries + 3 mutations + 2 tables + drawer + badges in one file. Split along existing seams (`UploadDrawer`, `ImportDetailPanel`, `ImportRowsSection`); the page becomes ~80 lines of composition.
- **`access.ts` (299 lines) — MAJOR.** Auth predicates + a nav-filtering engine + concrete nav content with icon-library imports in one module. Split nav spec/content into `features/navigation/`; auth becomes UI-free.
- **`DatabaseSeeder.php` (473 lines) — minor, trending.** Split into composed `DemoAccountsSeeder`/`DemoRegistrySeeder`/`DemoInvitationsSeeder`.
- Nothing crosses 1,000 lines; the threshold blocker doesn't fire.

### 7. Legibility

- Search-escaping idiom (`addcslashes` + `whereRaw LIKE`) duplicated in **five controllers**; pagination trio in **seven endpoints**; `applySort` duplicated wholesale in two. One `scopeSearch`, one `PaginatedListRequest`, one `SortParser`.
- `routes/api.php:29-42`: authorization split between route-level `->can()` (6 routes) and in-controller for everything else; portal routes indistinguishable from staff routes. Group them so the file states the access model.
- Job Processing→Completed/Failed lifecycle scaffolding triplicated across all three jobs — one `RunsTrackedJob` trait.
- Twin accept flows speak different exception dialects (staff: `abort()`, resident: `ValidationException`) — pick one; HTTP codes don't belong in Actions either way.
- `lib/dates.ts` hardcodes `es-PE` / `America/Lima` in a generic lib file — a market assumption disconnected from i18n and the per-location `timezone` the API already returns.
- `markAsPrimaryContact()` silently force-activates the membership — rename or drop the side effect before the first caller with an inactive row gets surprised.
- The en locale (231 keys, exact parity with es) is **unreachable**: `lng: 'es'`, no detector, no switcher. Maintained dead weight until wired; add a 10-line key-parity test either way.

---

## Code-judo opportunities (non-blocking)

- **Registry `validateSearch` double-normalization**: three copy-pasted `validateSearch` objects each followed by `normalizedRegistrySearch()` re-normalizing the same fields (and `Number(page)` → `NaN` slips through the first layer). One zod schema with `.coerce`/`.catch` owns the contract; the normalizer is deleted.
- **The `location?.id ?? ''` pattern** in every registry page: dead fallbacks existing only because the null-guard sits below the hooks. Split into a guard component + inner component receiving non-null `location`; every `?.`, `?? ''`, `enabled:` flag and the one `as File` cast evaporate.
- **`Controller` + error-translation blocks** repeated six times across the invitation pages (~15 lines each) → one `FormTextInput`/`FormPasswordInput` pair; both pages shed ~80 lines.
- `handle(?Dep = null)` + `??= app(...)` in all three jobs re-implements Laravel's queue method injection — delete the nullability.
- `selectAccount`'s manual single-location auto-pick duplicates a strictly stronger rule already in `resolveActiveLocation` — dead code, delete.
- `wouldGrantAccess()` pre-query in staff location sync duplicates data `sync()` fetches two lines later in the same transaction — run sync first, inspect the change-set, throw.
- Status-badge nested ternaries → `Record<Status, color>` lookups (also makes an unhandled status a compile error); `statusCounts()` → `countBy`; `PortalResidentController`'s ten `prohibited` rules protecting a single-column `forceFill` → validate `phone` alone.
- `location-switcher.tsx:44` fabricates a "current" location the server doesn't agree with — move the fallback rule next to `getDefaultLocation` or render a select prompt.
- Speculative props (`showNotifications`, `Brand.productAreaKey`) with zero callers — delete until needed.

## Verified sound — preserve through any refactor

Route-guard architecture (`guards.ts` — centralized, open-redirect-safe, hide/enforce provably share predicates); the nav-spec `visibleTo` predicate tree; invitation token hygiene (sha256-only, purpose-scoped resolution); transaction + `lockForUpdate` discipline in staff mutations including the last-admin lock; `api-client`/`query-client` setup; the Actions layer for staff/invitations, which is the template the registry controllers should converge toward.

## Bottom line

Merge-blocking items are the resident-claim race check, the untranslated validation keys, the front-desk 404 landing, the `portalStore` gate, and the atomic job-claiming — all small fixes. The structural debt (registry-page triplication, invitation issuance, the import-row DTO) is where the next month of velocity lives.
