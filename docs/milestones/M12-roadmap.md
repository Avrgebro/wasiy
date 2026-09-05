# M12 Roadmap: Visits (Visitantes) — walk-in phase

## Goal

The front desk's visit log (mockups 16 and 16b): a visitor arrives, the desk records who they are and which unit they go to, optionally how the visit was confirmed, and later marks them out — or the system does, after the location's configured hours. No approval workflow, no photos or ID images, no recurring authorizations. Pre-registration from the resident portal is the next phase; the desk drawer will then gain an "Esperados hoy" band under the unit and a read-only confirmation state.

## Decisions Confirmed (Jose, 2026-09-04)

- Walk-ins first; portal pre-registration later.
- Confirmation method is optional and informational: `none` (default), `intercom`, `phone`, `management`. It never blocks check-in.
- The desk sees the host resident's phone (tap to call), never emails.
- Status `inside` → `left`, one way. Optional check-out notes.
- Automatic check-out after `visitor_auto_checkout_hours` from the location's operational settings (0 = never), run by a scheduled command; the timeline shows "Salida automática".
- Retention (ADR 0024, 12 months) is a later prune job.

## Data Model

`visits`: id, account_id, location_id, unit_id, resident_id (nullable host), visitor_name, document (nullable), phone (nullable), confirmation (enum), notes (nullable), status, checked_in_by, checked_in_at, checked_out_by (nullable), checked_out_at (nullable), checkout_notes (nullable), auto_checked_out (bool), timestamps. Indexes `(location_id, status, checked_in_at)`, `(unit_id, checked_in_at)`.

## API Contract

- `GET /locations/{location}/visits?status=inside|left&today=1&confirmation=&search=&page=` — newest first; search covers visitor, document, unit and host.
- `POST /locations/{location}/visits {visitor_name, unit_id, resident_id?, document?, phone?, confirmation?, notes?}`.
- `POST /visits/{visit}/check-out {notes?}` — 422 if already out.
- `GET /units/{unit}` gains `visits` (last five).
- `visits:auto-check-out` command, scheduled every ten minutes.

Policy: any location staff (front desk included) can view, register and check out.

## Slices

1. Backend — table, enum, model, policy, actions, controller, routes, unit show, command and schedule, tests.
2. Frontend — Visitantes page (chips, filters, search, table with the overdue dot), row drawer with live time inside and check-out, register drawer, unit section, tests.
