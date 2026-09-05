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

- **P1 Shell and visitors** — portal shell with bottom tabs and unit switcher; home board (visitors and packages parts); visitor pre-registration and history; desk-side "Esperados hoy" and arrival confirmation. Closes the M12 second phase.
- **P2 Reservations and packages** — amenity browsing, booking requests, my reservations with cancellation; packages list; home board gains next reservation.
- **P3 Alerts** — notification center and email; preferences in the profile.
- **P4 My unit and profile** — members management for the primary contact, vehicles UI, estado de cuenta; phone, email, password.
- **P5 Announcements** — admin Anuncios module plus the portal feed; home board gains the latest announcement.

Each milestone: backend slice with tests, frontend slice with tests, mockups first.

## Parked

- WhatsApp alerts.
- Incident reports (needs a staff module to receive and resolve).
- Shared documents (reglamento, actas).
- Building contacts card (cheap; can ride along with P1 if a mockup includes it).
