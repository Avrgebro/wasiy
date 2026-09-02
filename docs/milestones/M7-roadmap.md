# M7 Roadmap: Reservations (Reservas)

## Goal

M7 turns the amenities built in M6 into bookable spaces. Staff get the `/admin/reservations` surface from mockup 08: a week-agenda list of bookings, a "Por aprobar" panel to adjudicate requests, a staff-side "Nueva reserva" flow, and a day viewer built on `@mantine/schedule`'s `DayView` in place of mockup 09's week grid. Residents booking from the portal is out of scope for M7 — staff create reservations on behalf of units.

The design principle is deliberate minimalism: the three levers that govern a booking are the ones the Amenity already models — **availability** (per-weekday windows), **cost** (`fee_amount` / `deposit_amount`, informational only), and **concurrency** (`capacity` and `max_concurrent_per_unit`). Everything else the amenity schema offers (durations, buffer, advance days, cancellation window) is enforced where cheap, but no new policy machinery is added.

Mockup 08 (`docs/mockups/Mockups.dc.html`, "08 · Reservas — ubicación seleccionada") is the authority on layout and Spanish copy for the list and approval panel. Mockup 09's week calendar is **replaced by a single-day viewer** (`DayView`), restyled to the Puerto system. This document is the authority on behavior and data.

## Current Starting Point

Already present:

- `Amenity` model with everything a booking decision needs: `availability` (per-weekday `{start,end}` windows), `booking_mode` (`instant` | `approval`), `capacity`, `max_concurrent_per_unit`, `min/max_duration_minutes`, `buffer_minutes`, `max_advance_days`, `cancellation_window_hours`, `fee_amount`, `deposit_amount`, `is_reservable`, `status`, and the effective-policy cascade from location settings.
- `Unit`, `Resident`, `UnitMembership` — a reservation belongs to a unit; the resident is the contact.
- Location timezone (every time in this feature is wall-clock local to the location).
- `/admin/reservations` route stub behind `checkSurfaceAccess`.
- Shared UI: `DataTable` toolbar pieces (`SearchInput`, `FilterButton`, `FilterChips`, `buildFilterChips`), `AppDrawer`, `notify*` toasts, activity log.

Missing entirely: any `Reservation` model, migration, policy, controller, action, resource, or frontend feature directory.

## Decisions Confirmed

- **Status machine**: `pending → approved | rejected | observed`, plus `cancelled` from `pending`/`approved`. `instant` amenities create directly as `approved`. "Completada" is **derived** (approved + end in the past), never stored. `observed` carries a required staff note; the request stays actionable (approve/reject) and staff or the resident can amend times, which returns it to `pending`.
- **Only `approved` holds capacity.** Pending requests never block a slot; the approver resolves contention. The approval action re-validates concurrency at approve time.
- **Fee snapshot**: `fee_amount` and `deposit_amount` are copied onto the reservation at creation. Payments are marked manually later (deferred); Wasiy does not process charges. The mockup's own footnote agrees.
- **Deferred from mockup 08**: the "Cuotas y depósitos" card and `deposit_paid` flag; the "Uso de la semana" analytics card; the "Depósito pendiente" status chip.
- **Day viewer instead of week grid**: the Lista/Calendario toggle becomes Lista/Día. `DayView` from `@mantine/schedule` renders one date in `static` mode (no drag) with pending events ghosted alongside approved ones.

## Data Model

One table, `reservations`:

| column | type | notes |
| --- | --- | --- |
| `id` | ulid | |
| `account_id`, `location_id`, `amenity_id` | ulid FKs | composite FKs mirroring the amenity's `(id, account_id)` pattern |
| `unit_id` | ulid FK | who the booking belongs to |
| `resident_id` | ulid FK, nullable | contact person; nullable for staff-created bookings with no resident attached |
| `starts_at`, `ends_at` | timestamps | stored UTC, interpreted in the location timezone |
| `status` | string enum | `pending` / `approved` / `rejected` / `observed` / `cancelled` |
| `status_note` | text, nullable | required when `observed` or `rejected` |
| `fee_snapshot`, `deposit_snapshot` | decimal, nullable | copied from the amenity at creation |
| `created_by`, `decided_by` | user FKs, nullable | audit trail; `decided_at` timestamp |
| timestamps, soft deletes | | |

Indexes: `(amenity_id, starts_at)` for overlap queries, `(location_id, starts_at)` for the day/list views, `(account_id, status)` for the approval queue.

### The booking rule (one validator, used by create and approve)

A slot is valid when all of:

1. The amenity `is_reservable` and `active`.
2. `[start, end)` falls inside an availability window for that weekday (location timezone).
3. Duration within `min/max_duration_minutes`; date within `max_advance_days` (staff bypass advance-days — front desk books same-day constantly).
4. Overlapping `approved` reservations (+ `buffer_minutes` padding) `< capacity`.
5. Unit's overlapping `approved` count `< max_concurrent_per_unit`.

Concurrency safety: the approve/create mutation wraps the overlap count + insert/update in a transaction with a `lockForUpdate` on the amenity row, the same serialization point for all writers.

## API Contract

All under the existing `accounts/{account}` group, authorized like amenities (location staff for their location, admins everywhere):

- `GET /locations/{location}/reservations?from=&to=&status=&amenity_id=` — list, eager-loads amenity/unit/resident names. One endpoint serves the week list, day viewer, and approval panel (`status=pending,observed`).
- `POST /locations/{location}/reservations` — staff create; validator above; `instant` → `approved`, `approval` → `pending`.
- `PATCH /reservations/{reservation}` — amend times (revalidates, resets `observed` → `pending`).
- `POST /reservations/{reservation}/approve` · `/reject` · `/observe` (note required for reject/observe) · `/cancel`.

Every transition writes an `ActivityLog` entry with before/after status, following the staff-invitation metadata pattern.

## Frontend

New `features/reservations/` following the locations/staff shape: `api.ts`, `schemas.ts` (URL contract: `view=list|day`, `date`, `status`, `amenity_id`), page, and components.

**Page layout (mockup 08):** header with Lista/Día segmented toggle + "Nueva reserva" accent button; status chips row (Todas / Pendientes · n / Confirmadas / Completadas) + amenity select on the right; then the two-column grid — main view (1.7fr) and right rail (1fr) with the "Por aprobar" card. The chips reuse `FilterButton`/`buildFilterChips` conventions; the grouped-by-day list is a custom component (day-band headers, 3px amenity accent bar, status pills), **not** a `DataTable` — same documented exception as the locations card grid.

**Por aprobar panel:** cards with amenity, slot, unit · resident · fee line from the snapshots, waiting-time line, and a computed conflict line (client-side against the loaded approved reservations). Actions: Aprobar (accent), Observar, Rechazar — the latter two open a small note modal.

**Nueva reserva drawer** (`AppDrawer`): amenity select → unit search-select → resident (optional, filtered by unit) → date + start/end pickers constrained to the amenity's windows for that weekday. Server is the source of truth for validation; the drawer surfaces 422s via `submitHandlingServerErrors`.

### Day viewer: `@mantine/schedule` DayView

- New dependency `@mantine/schedule@^9.3` (matches the app's Mantine 9.3 line; brings `dayjs`).
- Render `static` mode (no drag/resize in M7), `date` from the URL, `startTime`/`endTime` derived from the union of the day's amenity windows (fallback 08:00–23:00), `intervalMinutes=30`, `withCurrentTimeIndicator` when the date is today.
- Events map from reservations: `title` = amenity name, `payload` = the reservation; `color` unused — styling goes through `renderEventBody` + the Styles API instead of Mantine color names.
- **Puerto restyle** via the documented hooks: `classNames` on `.mantine-DayView-*` selectors plus the CSS variables (`--day-view-radius: 14px`, `--day-view-slot-height`). Grid lines use `--mantine-color-default-border`, slot background the card surface, time labels dimmed 11.5px uppercase like table headers. Event blocks: approved = `--wa-secondary` tinted block with 3px full-strength left bar (the mockup's accent-bar language); pending = same at ~50% opacity with dashed border; unit label as the second line, mirroring mockup 09's blocks. All tokens, so dark/light are automatic.
- Clicking an event opens the reservation detail (popover or the drawer in read mode) with cancel/approve actions per status.

## Slices

1. **Backend foundation** — migration, model, policy, validator action, list/create endpoints + transitions, feature tests for the booking rule (window edges, capacity, per-unit cap, buffer, instant vs approval). *Deliverable: API green in tests, nothing visible.*
2. **Lista + Por aprobar** — page shell, URL contract, week-agenda list grouped by day, status chips + amenity filter, approval panel with approve/observe/reject and notes. *Deliverable: mockup 08 minus the deferred cards.*
3. **Nueva reserva drawer** — staff create flow end to end, 422 surfacing, toasts.
4. **Day viewer** — install `@mantine/schedule`, DayView with Puerto restyle, Lista/Día toggle, date navigation (‹ Hoy ›), event detail on click.
5. **Polish** — sidebar badge with pending count, cancellation window enforcement for non-admin staff, empty states, jsdom tests for the list and approval flows.

Slices 1–2 are the tracer bullet; 3 and 4 are independent of each other after 2.

## Post-ship revision (2026-09-01)

The Día view shipped in slice 4 and was then **removed**: at condominio booking volumes the hour grid was mostly empty space, its conflict-spotting value was already covered by the Por aprobar conflict line and the approve-time revalidation, and `@mantine/schedule` was the highest-maintenance surface of the milestone (static-mode pointer-events, header suppression, exact core-version pinning). The Lista week agenda is the single view; its rows open a detail modal (status, slot, note, approve/cancel) ported from the day view. `@mantine/schedule`, `@mantine/dates`, and `dayjs` were removed.

## Risks

- `@mantine/schedule` is the newest Mantine package; if its Styles API hooks prove insufficient for the Puerto look, the fallback is keeping Lista as the only M7 view and building the day grid by hand later — the URL contract (`view=` param) doesn't change either way.
- Timezone edges: all validation compares wall-clock times in the location's timezone; tests must pin a non-UTC timezone (America/Lima) to catch UTC-boundary bugs.
- The conflict line in Por aprobar is client-computed and advisory; the transaction at approve time is the real guarantee.
