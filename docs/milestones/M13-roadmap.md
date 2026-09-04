# M13 Roadmap: Panel (dashboard)

## Goal

Replace the placeholder Panel with the operational board from mockups 17, 17b and 17c: one page, two compositions. Every staff member sees the **Hoy** strip (quick actions, visitors inside, packages pending, today's reservations). Managers and account admins also see the **Administración** strip (dues, balances, deposits, residents to invite, occupancy, activity feed). No separate front-desk route (ADR 0035).

## Decisions Confirmed (Jose, 2026-09-04)

- One route, one component; the management strip is a role-gated section, not a page.
- Operations first even for managers; finances below.
- "Movimientos pendientes" = ledger movements in `pending` status. Front desk sees "Salidas registradas hoy" in that tile's place.
- The overdue visitor flag is computed server-side against the location's effective `visitor_auto_checkout_hours` (0 = never flagged). The setting itself is not exposed to the client.
- All tiles remain purely statistical (no interpretive copy).

## API Contract

`GET /locations/{location}/dashboard` (policy: view location) returns:

- `location` — id, account_id, name, slug, timezone.
- `today` — `date`, `visitors_inside_count`, `visitors_overdue_count`, `visitors_inside` (5, longest stay first, each with `is_overdue`), `exits_today_count`, `packages_pending_count`, `packages_oldest_received_at`, `packages_pending` (5, oldest first), `reservations_today_count`, `reservations_with_deposit_count`, `reservations_today` (all pending/observed/approved starting today in the location's timezone), `pending_movements_count`.
- `management` — **omitted entirely** when the caller cannot manage the registry. `month`, `dues_issued_total` (maintenance dues for the month, not voided), `dues_collected_total` (paid), `units_with_balance_count` (distinct units with pending income), `deposits_held_total`, `deposits_held_count`, `residents_not_invited_count` (active residents in the location with no user and no pending invitation), `units_total` / `units_occupied` / `units_vacant` / `units_without_primary_contact` (active units only), `activity` (last 6 entries for the location).

The previous `metrics.assigned_staff_count` is gone; the mockup has no staff tile.

## Slices

1. Backend — controller rewrite and tests (done 2026-09-04).
2. Frontend (done 2026-09-04) — Panel page: header with date line, role-gated quick actions (visit/package drawers opened in place; movement/dues linking into Finanzas), Hoy tiles and cards, Reservas de hoy table, Administración tiles, Unidades bar, Actividad reciente; empty states; tests for both compositions.
