# M11 Roadmap: Residents Directory (Residentes)

## Goal

Residentes becomes a directory of the people of the selected building (mockups 15 and 15b): who they are, where they live, how to reach them. Units stay the place where memberships are managed; the directory points at them. Staff create a person with names and an optional phone; email is asked only when inviting to the portal; front desk sees phones, never emails.

## Decisions Confirmed (Jose, 2026-09-04)

- **Scoped to the active location**: only people with a membership (any status) in that location. No cross-location view; a manager with two buildings switches location like everywhere else. The API already refuses locations the staff member is not assigned to.
- **Email is never typed at creation.** It is asked when sending the portal invitation and stored on the person then. No duplicate detection on phone; email is validated only at invitation.
- **Phone is optional and staff-editable**; the resident can correct it from the portal later.
- **Front desk sees phones, not emails**, enforced in the API resource, not only in the UI. Front desk does not create, edit or invite.
- **Memberships are managed from the unit.** The person drawer lists them with links; no add/remove there.
- **Desactivar persona** is allowed only when the person has no active membership; otherwise the drawer points to the units.
- Person detail is a drawer, not a page. No photos, documents, emergency contacts or bulk actions.

## API Contract

- `GET /accounts/{account}/residents?location_id=&search=&role=&portal=&no_unit=&status=&page=` — search covers name, phone and unit number; `role` filters by resident type of an active membership in the location; `portal` = `active | invited | not_invited`; `no_unit=1` = memberships in the location but none active. Resource adds `portal_state`, `active_membership_count`, gated `email`.
- `GET /residents/{resident}` — resource plus `additional.history`: activity entries about the person (subject) or mentioning them (`metadata.resident_id`), newest first.
- `POST /residents/{resident}/invitations {email}` — now also stores the email on the person when it has none.
- `POST /residents/{resident}/deactivate` — 422 while an active membership exists. `POST /residents/{resident}/reactivate`.

## Slices

1. Backend — filters, gated resource, portal state, show with history, invitation email save, deactivate guard, tests.
2. Frontend — directory on `DataTable`, person drawer, person form drawer, member drawer (12c) without email field, removal of the last `RegistryCrudPage` page.

## Revision (2026-09-04) — memberships carry no role

While building the directory Jose dropped the resident type altogether: once a unit is rented the owner has no operational relationship with it, so the directory lists people who live there, full stop. `resident_type` is gone from every request, resource, export column, seeder, factory and UI (drawers, pills, directory chips now Todos / Sin unidad). The column stays nullable on `unit_memberships` only because the CSV import still writes it; the import will be redesigned separately. An owner contact, if ever needed, goes on the Unit. Mockups 12c/15/15b still show a Rol field; ignore it.
