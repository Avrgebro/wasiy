# Reservations Are Exclusive Slots

A reservation is an exclusive booking of an Amenity, for one or more consecutive slots inside its opening hours, gated by a yes-or-no decision when the Amenity requires approval. That is the whole rule set. This ADR supersedes the booking-policy decisions in the M7 roadmap (capacity, buffer, min/max duration, advance horizon, per-unit concurrency, cancellation window, and the settings cascade that governed the last three).

## Context

The PRD scopes V1 reservations to availability days/hours, instant versus approval, unit ownership, staff decisions, and manual fee/deposit tracking. It lists capacity management, cancellation rules and amenity-specific policies under Advanced Reservations, out of V1. M7 shipped all three anyway: 34 distinct rules on a booking, 22 admin-facing fields between the amenity form and the operational settings, 39 UI strings whose only job was to explain a rule, and slot math implemented three times (server validator, staff drawer, portal generator). Coverage did not keep up: one test on the concurrency sweep, one on buffer padding, none in a daylight-saving timezone, max advance days enforced on the portal but not on staff creation, cancellation logic duplicated, two unreachable `24:00` branches, and a portal store that accepted ranges never offered.

At condominio volumes the contention that matters is one: two units wanting the salón at the same time. An exclusive booking rule resolves it; the approver resolves everything else with a note.

## Decisions

- **Amenity booking fields**: `is_reservable`, `booking_mode` (`instant` | `approval`), `availability` (per-weekday `{start,end}` windows), `slot_minutes` (default 60), `fee_amount`, `deposit_amount`. Dropped: `capacity`, `buffer_minutes`, `min_duration_minutes`, `max_duration_minutes`, `max_advance_days`, `max_concurrent_per_unit`, `cancellation_window_hours`.
- **Slots**: each availability window is cut into consecutive slots of `slot_minutes` from the window start; a tail shorter than a slot is not offered. A booking covers one or more consecutive slots of the same window. The server is the only place that computes slots; both surfaces read `GET …/amenities/{amenity}/availability?date=&unit_id=` and post what it offered.
- **Rules on a booking** (`ValidateReservationSlot`): the Amenity is reservable and active; the Unit belongs to the Amenity's Location; `[start, end)` is aligned to the slot grid of one window on that local weekday; start is in the future; no `approved` reservation of the same Amenity overlaps. Only `approved` holds the slot; pending and observed never block.
- **Advance horizon**: a fixed 90 days for both surfaces, a constant, not a setting.
- **Cancellation**: residents may cancel their own pending, observed or approved bookings until the start time; staff may cancel any time. No window, no admin bypass.
- **Statuses**: `pending`, `approved`, `observed`, `rejected`, `cancelled`; `completed` stays derived (approved and past). `observed` is kept: it is a plain state with no rule math, and removing it is a data migration for little gain.
- **Operational settings**: the three reservation keys (`reservation_max_advance_days`, `reservation_max_concurrent_per_unit`, `reservation_cancellation_window_hours`) leave `OperationalSettings`; `SettingsResolver::bookingPolicyFor` and the `effective_booking_policy` field are removed. Quiet hours remain informational.
- **One decisions module** on the staff surface: approve, observe, reject and cancel are implemented once and used by the drawer and the queue.

## Consequences

The amenity form loses the Política de reserva section; the booking fields are the switch, the schedule, the slot length and the fees. The operational settings panel loses its Reservas group at both levels. The staff Nueva reserva drawer picks a date, then a start slot and an end from the following free slots, all from the server's list. The portal picks a slot the same way and posts it. Existing reservations are untouched: the migration drops amenity columns only, and the new alignment rule applies to new bookings. The validator drops from thirteen rules to five, and the remaining tests can cover the whole surface, including a daylight-saving timezone.

Post-V1 additions, if ever needed, return as explicit features against this baseline rather than as knobs: a per-amenity cancellation notice, a per-unit booking cap, guest lists.
