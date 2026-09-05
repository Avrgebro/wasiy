# Capability-Based Authorization

Staff hold roles (Account Admin, Location Manager, Front Desk), but the code checks capabilities. A single matrix, `Capability::forRoles()` in the API, maps each role to what it may do in a Location. Policies call `AccessAuthorizationService::can($user, $location, Capability)`, and `/me` delivers the active Location's capability list so the SPA gates navigation, route guards and page actions with `can(me, capability)` without re-deriving permissions from roles.

Before this, both sides asked "which roles does this user hold?" and each caller decided what a role implied. The manager predicate (`canManageRegistry`) drifted into gating finances, announcements and reservation approvals; the SPA duplicated the role logic and checked roles across every location instead of the one being viewed, so a manager of one building browsing another as front desk saw the manager UI.

## The matrix

| Capability | Admin | Manager | Front desk |
| --- | --- | --- | --- |
| `registry.view` — units, residents (phones, no emails), vehicles | ✓ | ✓ | ✓ |
| `registry.manage` — create/edit units, residents, memberships, vehicles; import/export | ✓ | ✓ | |
| `reception.manage` — visits and packages | ✓ | ✓ | ✓ |
| `reservations.view` — calendar and amenities | ✓ | ✓ | ✓ |
| `reservations.create` — request and cancel bookings | ✓ | ✓ | |
| `reservations.decide` — approve/observe/reject; manage amenities | ✓ | ✓ | |
| `finances.manage` — ledger, dues, deposits, Panel management strip, unit ledger sections | ✓ | ✓ | |
| `announcements.manage` | ✓ | ✓ | |
| `location.settings` — operational settings of the Location | ✓ | ✓ | |
| `account.manage` — locations, staff, activity, account settings | ✓ | | |

An Account Admin holds every capability in every Location of the account. A location role grants its row in that Location only. Deactivated Locations grant nothing.

## Decisions

- Capabilities are an enum in code, not rows in a database. Three roles and ten capabilities are easier to read and test as a 20-line match than as a permission table. If a customer ever needs per-account overrides, `can()` is the one place to consult them before falling back to this matrix; the vocabulary stays.
- `/me` carries `active_location.capabilities` (and the same on each accessible location). The SPA's `can()` reads only that list; account-level checks (`isAccountAdmin`) still read the account role because an admin with no Location yet must still reach Administración.
- Response shaping follows the same capability: the dashboard omits `management` and the unit endpoint omits `movements`, `movements_month` and `pending_balance` unless the caller holds `finances.manage`. Keys are absent, never empty.
- Front desk is read-only on reservations. Earlier the desk could request and cancel bookings at the counter; that moved to managers. Restoring it is adding `reservations.create` to the desk row.
- Unidades is hidden from the desk's sidebar and its routes are guarded on `registry.manage`. The desk finds people through Residentes.

## Consequences

Adding a role means adding a row to `forRoles()` and a fixture constant in `access.ts`. Splitting a capability means adding a case and choosing which rows get it. A test asserts the matrix and its shape in `/me`; frontend tests build fixtures from the mirrored constants (`FRONT_DESK_CAPABILITIES`, `MANAGER_CAPABILITIES`, `ADMIN_CAPABILITIES`). ADR 0035's `isFrontDesk` helper is gone; nothing needs the role itself any more.
