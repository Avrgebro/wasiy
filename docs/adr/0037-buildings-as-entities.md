# Buildings as Entities

Towers inside a Location are rows in a `buildings` table, and units point at a building by id. The free-text `building_name` column on units is gone. Every Location has at least one Building from creation; while it has exactly one, that Building is unnamed and the UI shows no tower anywhere. Naming is required the moment a second Building exists.

Free text let a typo fork a tower: "Torre A" and "Torre  A" were two buildings to the filters, the grouping and the uniqueness rule. The alternative of keeping names as keys with a rename cascade was proportionate but left the same name threaded through labels, search, import identity and a COALESCE unique index, with a rename that had to be told apart from a remove-plus-add. Early in development, the proper model costs about the same as the workaround.

## Decisions

- `buildings`: id, account_id, location_id, name (nullable, unique per location case-insensitively when present), code (short prefix such as "T1"), sort_order. `units.building_id` is NOT NULL with a restrict-on-delete foreign key. Unit numbers are unique per building per location.
- One row from birth: `CreateLocation` and the Location factory create the unnamed default. The migration backfills one Building per distinct name in use plus an unnamed default per Location, then drops the default where every unit already had a tower.
- Growth path: a single-building Location adds a second tower by naming the first and adding the next. Existing units are already attached, so nothing needs reassigning.
- Deleting the last Building is refused; deleting a Building with units is refused with the count. Renaming is one update; units follow by reference.
- `building_name` survives as a virtual attribute on Unit: readable everywhere (resources keep emitting it, so lists did not change), and writable so factories, seeders and the CSV import can set a tower by name and have it resolved or created in the unit's Location. The API itself accepts only `building_id`, validated to belong to the target Location.
- Endpoints under `/locations/{location}/buildings` and `/buildings/{building}`. Reading needs `registry.view`; writing needs `location.settings` (ADR 0036).
- Ordering by tower everywhere uses the Building's `sort_order` through `Unit::orderByBuilding()`; searching by tower uses `Unit::searchIdentity()`.

## Consequences

The unit form shows a required tower select only when the Location has two or more Buildings. The location settings page gains an editable list of towers with per-row unit counts. The CSV import, when redesigned, resolves the "edificio" column to a Building and can flag unknown names instead of creating them silently. Towers can grow attributes (floors, intercom prefix) without touching units.
