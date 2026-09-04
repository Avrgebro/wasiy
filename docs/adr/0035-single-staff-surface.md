# Single Staff Surface

Every staff role — Account Admin, Location Manager and Front Desk — uses the same admin surface at `/admin`. Front Desk sees a reduced, mostly read-only version of it: navigation entries and page actions decide their own visibility with the same predicates the API policies enforce. The separate `/front-desk` shell planned in the PRD and stubbed in the app is removed.

The PRD imagined a simplified operations shell for security staff. In practice the front desk needs the same lists managers use — units, residents, reservations, visitors, packages — with fewer actions, not a different information architecture. Maintaining two shells would have meant duplicating pages or hiding the desk's work behind a second navigation, and every feature would have had to be mounted twice.

## Decisions

- `canAccessAdmin` includes the Front Desk role; `/front-desk` and its navigation group are deleted. The default route after login for front desk is `/admin`.
- Visibility is layered: navigation predicates hide manager-only entries (Anuncios, Finanzas, the Administración group); pages hide manage actions behind `canManageRegistry` (create, edit, decide, notes, drawers); the API policies remain the enforcement point and return 403 regardless of the UI.
- Read-only means read-only, not disabled: a front desk user sees no create buttons, no row edit, no chevrons on rows that would open a manage drawer. `RegistryCrudPage` gained a `readOnly` prop for the older registry pages.
- The resident portal stays a separate surface: it is a different audience, not a different role.

## Consequences

Features are built once and mounted once. New surfaces for the desk (Visitantes, Paquetería) land under `/admin` in a Recepción group. The dashboard is still the manager's Panel; a slimmer front-desk landing can come later without touching routing. The `isFrontDesk` helper remains for places that need the role itself rather than a capability.
