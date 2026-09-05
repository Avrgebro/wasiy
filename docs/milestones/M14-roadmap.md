# M14 Roadmap: Buildings (towers) as entities

## Goal

Stop typos from forking towers. Towers become rows (ADR 0037); the unit form offers a select fed by the Location's buildings, shown only when there are two or more; the location settings page manages the list.

## Decisions Confirmed (Jose, 2026-09-05)

- Proper model over a rename cascade: early development, so pay the refactor once.
- Every Location has at least one Building; single-building Locations keep it unnamed and see no tower anywhere.
- Editable list, not a TagsInput: renaming in place, delete disabled while in use, last one never deleted.
- Default building name: none while alone; required once a second exists.

## Slices

1. Backend (done 2026-09-05) — `buildings` table and backfill migration, Building model and factory, Unit `building_id` with virtual `building_name`, `searchIdentity`/`orderByBuilding` scopes, requests accept `building_id`, BuildingController + policy + routes, seeders and tests.
2. Frontend — buildings list in location settings (inline rename, code, reorder later, delete with count guard); unit create/edit drawer with a required tower select when the Location has 2+ buildings; units filter by tower id; TypeScript types (`building_id`, `building_code`).

## Deferred

- Reordering UI (the API already stores `sort_order`).
- Import redesign: resolve the "edificio" column to a Building.
