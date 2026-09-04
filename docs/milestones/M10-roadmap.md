# M10 Roadmap: Package Reception (Paquetería)

## Goal

A minimal package log for the front desk (mockups 14 and 14b): a parcel arrives for a unit, the desk records it in three fields, the addressed person — or the unit's primary contact — gets an email, and the desk marks it delivered when it is picked up. Two statuses, one action, no couriers, tracking, photos, quantities, returns or exports.

Mockups 14 and 14b in `docs/mockups/Mockups.dc.html` are the authority on layout and copy; this document on behavior and data. Built on the single staff surface (ADR 0035): front desk registers and delivers from `/admin/packages`.

## Decisions Confirmed (Jose, 2026-09-03)

- Fields: unit (required), person (optional, an active member of the unit), notes (optional). Received by and at come from the session.
- Statuses: `pending` (En recepción) → `delivered` (Entregado). One way; a mistake is fixed by registering again. Delivery records an optional free-text "entregado a".
- Notification on registration: email to the named person; else to the unit's primary contact; skipped when neither has an email. The address used is stored on the record so the drawer can say who was notified.
- Navigation: a **Recepción** group with Visitantes and Paquetería; Personas keeps Residentes.
- Unit detail gains a "Paquetes en recepción" section (read-only list).
- No reminders, no export, no portal card in this milestone.

## Data Model

`packages`: id, account_id, location_id, unit_id, resident_id (nullable), notes (nullable), status, received_by, received_at, delivered_by (nullable), delivered_at (nullable), delivered_to (nullable string), notified_email (nullable), timestamps. Indexes on `(location_id, status, received_at)` and `(unit_id, status)`.

## API Contract

- `GET /locations/{location}/packages?status=&search=&page=` — newest first; search covers unit number, building and resident name.
- `POST /locations/{location}/packages {unit_id, resident_id?, notes?}` — registers, notifies, logs `package.received`.
- `POST /packages/{package}/deliver {delivered_to?}` — logs `package.delivered`; 422 if already delivered.
- `GET /units/{unit}` gains `packages` (pending) in its `additional` payload.

Policy: any location staff (front desk included) can view, register and deliver.

## Slices

1. Backend: table, enum, model, policy, notification, actions, controller, routes, unit show, tests.
2. Frontend: Recepción nav group, `/admin/packages` page (chips En recepción / Entregados / Todos, search, DataTable, row drawer with Marcar entregado), register drawer, unit detail section, tests.
