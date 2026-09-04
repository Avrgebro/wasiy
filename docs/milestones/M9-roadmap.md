# M9 Roadmap: Units (Unidades)

## Goal

M9 rebuilds the unit surfaces from mockups 11–12f: a Unidades list on the shared `DataTable`, a unit detail page that is the home for residents, vehicles, bookings, charges and internal notes, and the drawers to create and edit units, attach people and register vehicles. Vehicles stop being a module: they live inside the unit, and plates are found from the units search. Units gain the fields a Peruvian condominio needs — type, area, participation share (alícuota) and the monthly maintenance fee — and Finanzas gains "Generar cuotas del mes", one pending dues movement per unit from that fee.

Mockups 11, 12, 12b–12f in `docs/mockups/Mockups.dc.html` are the authority on layout and Spanish copy; this document is the authority on behavior and data.

## Current Starting Point

- `units`, `residents`, `unit_memberships` (resident type, primary contact, active/inactive), `vehicles` (plate, type, make, model, color, status) with controllers, policies, activity logging and Pest tests (M3). `ResidentController::store` already accepts a `memberships` array, so "Nueva persona" needs no new endpoint.
- Registry pages for units, residents and vehicles on `RegistryCrudPage`; CSV import for units and residents; per-registry CSV exports.
- Finances (M8) with movements per unit; reservations (M7) per unit.

## Decisions Confirmed (Jose, 2026-09-03)

- **Units are homes only.** Types: departamento, casa, local comercial, oficina. Parking spots and storage rooms are text labels on the unit (`parking_spots`, `storage_rooms`, comma-separated), not units.
- **New unit fields**: `type`, `area_m2`, `participation_share` (%), `maintenance_fee` (whole soles, nullable), `parking_spots`, `storage_rooms`. Bedrooms are not tracked. Occupancy, owner and balance are derived, never stored.
- **Vehicles merge into units**: Vehículos section on unit detail, plate search on the units list, nav entry and `/admin/registry/vehicles` removed. Backend vehicle endpoints and the CSV export stay; the resident portal is unchanged.
- **Roles**: the `ResidentType` enum stays; labels change — owner → Propietario, tenant → Inquilino, occupant → Residente, guest_resident → Otro.
- **Visitas recientes and "Registrar visitante" are left out** until the visitors module exists.
- **Notas internas** are append-only activity-log entries on the unit (`unit.note_added`), staff-only, no edit or delete.
- **Deactivating a unit cascades**: memberships end, vehicles go inactive, future reservations are cancelled (which voids their pending charges and flags held deposits), all logged. Reactivation restores the unit only.
- **Dues generation** is part of this milestone: `POST /finances/dues {month}` creates one pending `maintenance_dues` movement per active unit with a fee, idempotent per unit and month through a `period` column.
- Standard pager, no "Cargar más". Row click opens the detail page (not a drawer): a unit has too many sections for a drawer.

## Data Model

`units` gains: `type` (string enum, default `apartment`), `area_m2` (decimal 8,2, nullable), `participation_share` (decimal 6,3, nullable), `maintenance_fee` (unsigned int, nullable), `parking_spots` (string, nullable), `storage_rooms` (string, nullable).

`financial_movements` gains `period` (`YYYY-MM`, nullable) with a unique index on `(unit_id, category, period)` — the idempotency key for dues.

Derived on the unit resource: `occupancy` (`occupied` | `vacant` | `attention` — attention = residents but no primary contact), `portal_state` (`active` if any resident has a user, else `invited` if any pending invitation, else `not_invited` if residents, else null).

## API Contract

- `GET /locations/{location}/units?search=&occupancy=&portal=&fee=&type=&status=&sort=&page=` — search covers unit number, building, resident names and plates; `fee=missing` finds units without a fee.
- `GET /units/{unit}` — unit with `members` (active memberships + resident + portal state), `vehicles`, and `additional`: `reservations` (next five), `movements` (current month), `pending_balance`, `notes`.
- `POST /units/{unit}/notes {body}` — appends an internal note.
- `POST /units/{unit}/deactivate` · `POST /units/{unit}/reactivate`.
- `GET /accounts/{account}/locations/{location}/finances/movements?unit_id=` and `GET /accounts/{account}/locations/{location}/reservations?unit_id=` — new filter on both lists.
- `POST /accounts/{account}/locations/{location}/finances/dues {month}` — returns `{created, skipped}`.

## Frontend

`features/units/` rebuilt: list page (chips Todas / Ocupadas / Vacías / Sin contacto principal / Sin portal / Sin cuota, Filtros popover with type, search, building group headers, row → `/admin/registry/units/$unitId`), detail page (header facts strip; sections Residentes, Reservas de la unidad, Cuotas y cobros with pending balance and "Ver en Finanzas →", Vehículos, Portal del residente, Notas internas), drawers (unit form in two sections with Zona sensible; resident add/manage with Persona existente | Nueva persona; vehicle), `ConfirmDialog` for deactivate and remove. Mobile per 12f: table scrolls, header stacks, actions full width.

## Slices

1. **Backend** — columns, enum, requests, resource with derived states, list filters and search, show with sections, notes, deactivate/reactivate cascade, `unit_id` filters, dues generation, tests.
2. **Units list** on `DataTable`, replacing the `RegistryCrudPage` units page.
3. **Unit detail page.**
4. **Drawers and confirmations** (unit, resident, vehicle).
5. **Wrap-up** — remove Vehículos nav and route, deep links from reservations and finances, seeder with fees, docs.
6. **Generar cuotas del mes** on the finances page.

## Post-ship revision (2026-09-03)

Slices 1–5 shipped the same day. Notes against the plan:

- Vehicles: the `/admin/registry/vehicles` route now redirects to the units list and the nav entry is gone; `features/vehicles/api.ts` stays for the vehicle drawer. The mockup's per-vehicle parking spot has no field behind it and was left out.
- "Nueva persona" reuses `POST /accounts/{account}/residents` with `memberships[]`; the portal invitation is a second call and is skipped with a warning when the person has no email.
- Deep links: movement and reservation drawers link the unit; the unit page links the month in Finanzas and the reservations page.
- Demo units carry fees, areas, shares and labels so the list and dues generation have data.
