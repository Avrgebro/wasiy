# Resident Portal Roadmap

## Goal

The resident-facing side of Wasiy: a mobile-first web app where a resident sees what concerns their unit today, pre-registers visitors, requests amenities, reads announcements, follows packages, keeps their household and contact data current, and receives alerts for what the building does on their behalf. It shares tokens and components with the staff surface but not its layout: one column, a bottom tab bar, big tap targets, installable on the home screen.

## Decisions Confirmed (Jose, 2026-09-05)

- Mobile-first; a separate set of mockups, not the admin shell squeezed down.
- Unit switcher for residents with several units; the whole portal is scoped to the active unit.
- Household changes (add or remove people) and the estado de cuenta are for the unit's primary contact only. Other members see the rest.
- Alerts are in-app plus email in v1. WhatsApp delivery is a later add-on.
- Incident reports and shared documents are parked: valuable, not in this scope.
- Language stays es-PE.

## Scope

### Home
- Today board: expected visitors, packages waiting, next reservation, latest announcement, unread alerts count. Quick actions: Pre-registrar visita, Reservar.
- Unit switcher in the header when the resident has more than one active membership.

### Visitors
- Pre-register: visitor name, optional document, expected date (today or a future day), optional note. Cancel while not yet arrived.
- The desk sees pre-registrations in the register drawer's "Esperados hoy" band (mockup 16b) and confirms arrival, which becomes a normal visit.
- History: visits to my unit, newest first.

### Reservations
- Amenities of my location with photos, rules, fee and deposit, booking mode.
- Request a booking; instant-mode amenities confirm on the spot, approval-mode ones enter the staff queue. Validation reuses the staff-side rules (advance window, concurrent limit, max duration, overlaps).
- My reservations: upcoming and past; cancel inside the cancellation window; see status notes from staff.

### Packages
- Waiting for my unit and delivered history. Read-only.

### Announcements
- Feed of the location's published announcements, newest first, with a detail view. Depends on the admin Anuncios module, currently a placeholder.

### Alerts
- Notification center: reservation approved/observed/rejected, package received and delivered, pre-registered visitor arrived, announcement published. Read state; each alert opens its item.
- Email for the same events, per-event preferences in the profile.

### My unit (primary contact only for changes)
- Members: list; add a person (creates the resident, optional portal invitation); mark someone as moved out (ends the membership).
- Vehicles: list, add, edit, remove. API exists.
- Estado de cuenta: dues issued and paid by month, pending balance, deposits held for my reservations. Read-only; no payments.

### Profile
- Phone (PhoneInput), email (verification on change, since it is the login), password, sign out everywhere.
- Notification preferences.
- Installable: web manifest, icon, theme color.

## Milestones (value order)

- **P0 Two builds, one codebase (done 2026-09-05, ADR 0038)** — separate route trees and artifacts per surface, import boundary, unified login without the audience switcher, manifests per host.
- **P1 Shell and visitors (built 2026-09-05)** — portal shell with bottom tabs and unit switcher; home board (visitors and packages parts); visitor pre-registration and history; desk-side "Esperados hoy" and arrival confirmation. Closes the M12 second phase.
- **P2 Reservations and packages (built 2026-09-05)** — amenity browsing, booking requests, my reservations with cancellation; packages list; home board gains next reservation.
- **P3 Alerts (built 2026-09-05)** — bell with unread count, Alertas list, branded alert email, per-family email switches in Perfil.
- **P4 My unit and profile** — members management for the primary contact, vehicles UI, estado de cuenta; phone, email, password.
- **P5 Announcements** — admin Anuncios module plus the portal feed; home board gains the latest announcement.

Each milestone: backend slice with tests, frontend slice with tests, mockups first.

## P2 decisions (2026-09-05)

- Any member of the unit may request a booking; the fee lands on the unit's ledger as today.
- Availability is a day picker with free slots for one amenity, not a week grid. A slot is `min_duration_minutes` long (60 when unset), laid on the amenity's availability windows; each slot is checked with the same validator staff bookings use (grid, duration, buffer, capacity, per-unit limit).
- The amenity detail's "Reglas" shows the description; a dedicated rules field can come later.
- Residents may read amenity photos: the amenity view policy admits residents with an active membership in the location.

## P2 slices

1. Backend — portal amenities list, availability per day, reservations list (upcoming/past), request, cancel inside the window, detail with history; resident policies; tests.
2. Frontend — Reservas tab (Mis reservas / Amenidades), amenity detail sheet, day strip + slots sheet, reservation detail sheet with cancel, home "Próxima reserva" card and "Reservar" quick action.

## P3 decisions (2026-09-05)

- One `resident_alerts` row per recipient resident (not Laravel's `notifications` table): unit-scoped, typed `kind`, a morph to the reservation, package or visit, personal `read_at`.
- Fan-out: every active member of the unit with portal access gets the in-app row; email goes to everyone with an address (login email first, registry email otherwise) whose family switch is on. A package addressed to one person alerts only that person.
- Kinds: reservation approved/observed/rejected, package received/delivered, visit arrived (any check-in for the unit, walk-in included), announcement published (emitted from P5).
- Preferences live on the resident as `email_alerts` JSON (null = all on), four families: reservations, packages, visitors, announcements.
- The list and the badge follow the active unit like the rest of the portal. Badge polls once a minute.
- Email: one `ResidentAlertNotification` (`mail.resident-alert`, theme `wasiy`, published `layout.blade.php` carrying the dark-mode media query since the inliner drops it). Dark is best effort: Gmail and Outlook ignore it. Links use `WASIY_PORTAL_URL`.
- Retention: `alerts:prune` daily deletes read alerts older than `WASIY_ALERT_RETENTION_DAYS` (90).
- API: `GET /portal/alerts?unit_id&scope=new|all`, `GET /portal/alerts/unread-count`, `POST /portal/alerts/{id}/read`, `POST /portal/alerts/read-all`, `GET /portal/resident`, `PATCH /portal/resident/email-alerts`.
- Portal: bell in the header → `/portal/alertas` (chips Nuevas · n / Todas, Marcar todo como leído, rows open the booking sheet via `?reserva=`, the home for packages, Visitas for arrivals). Perfil gains "Notificaciones por correo".
- Left for P4: the "Mi hogar" member list drawn in mockup 03c (needs the members endpoint), editable login email.

## Parked

- WhatsApp alerts.
- Incident reports (needs a staff module to receive and resolve).
- Shared documents (reglamento, actas).
- Building contacts card (cheap; can ride along with P1 if a mockup includes it).

## P1 notes (2026-09-05)

- Pre-registrations are visits in status `expected` (columns `expected_on`, `expected_time`, `pre_registered_by`, `pre_registered_at`, `cancelled_at`; check-in columns nullable). Desk confirmation moves them to `inside` with confirmation `pre_registered`; the resident's cancellation to `cancelled`. Walk-ins unchanged.
- API: `POST /portal/visits`, `GET /portal/visits?unit_id&scope=expected|today|history`, `POST /portal/visits/{id}/cancel`, `GET /portal/packages?unit_id&status`; staff `GET /locations/{id}/visits?expected=1&unit_id=` and `POST /visits/{id}/confirm-arrival`. The staff list hides expected rows unless asked (the door log stays the door log).
- Portal shell: header with unit pill (switcher sheet), tab bar Inicio · Visitas · Perfil (Reservas and Mi unidad arrive with P2/P4), no bell until P3. Active unit persisted in localStorage.
- Staff: Visitantes gains the "Esperados hoy" chip; the register drawer follows 16c (unit first, Esperados hoy band, Confirmar llegada, read-only Pre-registrado pill).
