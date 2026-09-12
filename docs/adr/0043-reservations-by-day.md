# Reservations Are Days

A reservation is a Unit's booking of an Amenity for one calendar day. There is no time of day anywhere in the model. An Amenity is open on some weekdays and may carry an optional daily capacity that the resident portal respects and staff may override. This ADR supersedes the slot model of ADR 0041.

## Context

Residents of the buildings Wasiy targets described how bookings actually work: you reserve the salón or the gym for a day and go when you like; the only rule anyone meets is "there is a maximum number of reservations at the same time". Nobody picks a time window. ADR 0041 had already cut booking policy to slots, then to non-exclusive slots, then to runs of slots; each step removed logic and each step still asked the resident for a time nobody enforces. Removing time removes the slot builder, both slot grids, the duration select, the per-weekday window editor with its overlap checks, the daylight-saving edge cases and the time-based day board in one move.

## Decisions

- **Amenity booking fields**: `is_reservable`, `booking_mode` (`instant` | `approval`), `open_days` (array of weekday keys `monday`…`sunday`, at least one when reservable), `daily_capacity` (nullable positive integer; null means no limit), `fee_amount_minor`, `deposit_amount_minor`. Dropped: `availability`, `slot_minutes`.
- **Reservation**: `reserved_on` (date, the Location's calendar) replaces `starts_at` / `ends_at`. The migration derives it from the local date of `starts_at`. `completed` is derived: approved and `reserved_on` before today in the Location's timezone.
- **Rules on a booking** (`ValidateReservationDay`): the Amenity is reservable and active; the Unit belongs to the Amenity's Location; `reserved_on` is an open weekday; on creation, `reserved_on` is today or later and within `MAX_ADVANCE_DAYS` (90). Only approved bookings count toward capacity.
- **Capacity is a portal rule.** The portal refuses a request for a day whose approved count has reached `daily_capacity` (422, reason `full`) and shows the day as full. Staff creation and approval are never blocked by capacity; the week board shows the count against the capacity so the approver decides with the number in view. Instant amenities are where capacity matters: an instant salón with capacity 1 never auto-approves a second party.
- **Availability endpoint** (staff `GET /api/amenities/{amenity}/availability?from=&to=`, portal `GET /api/portal/amenities/{amenity}/availability?unit_id=&from=&to=`, range capped at 90 days): `{ days: [{ date, available, reason: null | 'closed' | 'past' | 'full', approved_count }], daily_capacity, booking_mode, fee_amount_minor, deposit_amount_minor }`. `full` is reported on both surfaces; only the portal enforces it.
- **Cancellation**: residents may cancel any open booking whose day has not passed (`reserved_on` is today or later in the Location's timezone, so same-day cancellation is allowed); staff any time. Capacity checks on the portal run inside the create transaction without a row lock: two simultaneous requests could both pass on a capacity-1 amenity, accepted at condominio volumes.
- **Staff reservations page**: the week list from mockup 08, on dates. One band per day that has bookings, rows of amenity, unit, resident and status with the per-amenity accent bar, a search box, status chips and an amenity filter. Two rows for the same amenity under one day band are a conflict at a glance. The week pager anchors on the URL `date` param. (A one-row-per-amenity week board was built and replaced the same day; Jose preferred the list.) `@mantine/schedule` is removed; `@mantine/dates` stays for the calendar and the day strip.
- **Statuses, decisions, fees, alerts, ledger**: unchanged.

## Consequences

The amenity form's booking section is a reservable switch, seven weekday checkboxes, an optional capacity, the approval switch and two fees. The staff drawer is amenity, unit, resident and a date picker with closed weekdays disabled. The portal booking page is the day strip and the request button, with full days marked. The validator has three rules. Every time-formatting helper for reservations (`formatTimeRange`, slot labels, duration labels, DST handling) is deleted, along with `lib/slot-runs.ts`, `SlotGrid`, the availability editor and the schedule package. Resident alerts and activity entries that quoted a time range now quote the date. Existing reservations keep their day; their time is dropped.

If a future customer needs times, the answer is a new optional `time_note` free-text field on the booking, not a return of slots.
