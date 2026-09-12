# Wasiy Design System

## Design Personality

The interface should feel calm, residential, and operational.

Wasiy is daily-use software for property managers, front desk/security staff, and residents. It should feel trustworthy, organized, and efficient without becoming cold, decorative, or marketing-heavy.

Design direction:

- Clean but not sterile.
- Warm enough for residents.
- Structured enough for front desk and security workflows.
- Dashboard-first and operational.
- Avoid loud gradients, playful visuals, oversized decorative UI, and marketing-style card layouts.

## Color: the «Puerto» palette

The product uses the **Puerto** palette documented in `docs/colorschema.md`: petroleum teal as brand, paper (`#F7F5F0`) instead of white as the light canvas, and a single amber accent. Fourteen semantic roles, each with a light and a dark value («un rol, dos valores»). Nothing in this document repeats the hex values; `colorschema.md` is the single source.

Roles, in the words the code uses:

- `primary` (teal): active navigation, solid brand buttons, data headings.
- `secondary` (teal, mid): icons, avatars, supporting emphasis.
- `interactive` (teal, link tone): links, actionable text, section rules and timeline dots in drawers, the selected-row bar.
- `accent` (amber): **one main action per screen** (`Registrar movimiento`, `Nueva reserva`, `Invitar`), highlighted figures such as receivables. Always dark text, never white.
- `bg`, `surface`, `surface-2`, `text`, `text-2`, `text-3`, `border`, `divider`, `hover`: canvas, cards and tables, fields and pills, three text levels (body, metadata, hints/chevrons/timestamps), card and control outlines, row separators inside a surface, and the paper fill for hovered or selected rows and default controls.
- `success`, `warning`, `error`, `info`: status roles; see Status Colors.

Rules:

- In dark mode the accent doubles as the warning color, so a warning always carries an icon and a label, never color alone.
- Hierarchy is built by elevation in dark mode (no shadows, borders and surface steps delimit) and by paper-versus-white in light mode.
- Light mode ladder: paper (canvas, Drawer, Modal) → white (cards, fields) → cream surface 2°. Inside a Drawer or Modal `--wa-surface-2` resolves to white and `variant="surface"` pills to cream, so inner cards keep a visible step without per-component changes (`colorschema.md` → Escalera en claro).
- The old violet direction is gone; the mockups in `docs/mockups/` are the visual reference.

### Using color in code

- **Tailwind classes** reference the semantic tokens: `text-[var(--wa-success)]`, `bg-[var(--wa-surface-2)]`, `border-[var(--mantine-color-default-border)]`. Never a raw hex in a feature component.
- **Mantine props** use the semantic scale names: `color="accent"`, `color="error"`, `color="success"`, `color="warning"`, `color="info"`, plus `gray` for neutral. Never `red`, `yellow`, `green`, `blue`.
- **Colored text and figures** (KPI values, amounts, icon marks) use the `--wa-*` tokens. Do not use Mantine's `--mantine-color-<role>-light-color` variables for text: in dark mode they resolve to the pale shade 3 of the scale and wash the intended color out. They exist for the `light` Badge variant, which is where they belong.
- Deposits in motion (held, to refund) use `--wa-interactive`, the teal the mockups use, not `info` blue.
- Mantine's `gray` scale is remapped to the palette's paper neutrals in `theme.ts`, and `--mantine-color-default-hover`, `--table-border-color` and `--table-hover-color` point at the `hover` and `divider` tokens. Never use Mantine's stock gray hex values or `gray-0..9` directly; in light mode they read cool and blue against the paper canvas.

## Interface Density

Use adaptive density.

Admin and Front Desk screens should be compact but readable because they support repeated operational work. Resident Portal screens should be more comfortable and clearer because residents use them less frequently and need fewer dense tables.

Defaults in use:

- Desktop page padding: `32px` horizontal; mobile `16px`.
- Panel and card padding: `16px` (`p-4`); KPI tiles `16px`; drawer body `20px` grid gap.
- Table rows: Mantine `verticalSpacing="sm"` (about `44px` with badges).
- Inputs and default buttons: Mantine `md`, `42px`; `sm` buttons `36px`.
- Icon buttons: `32px`, or `36px` beside inputs.
- Section gap on pages: `20px` (`gap-5`); `24px` on staff.
- Field gap in forms: `20px`.

Density guidance:

- Operational tables may be compact by default.
- Forms and destructive actions need enough spacing to reduce mistakes.
- Mobile layouts should prioritize clarity over row count.

## Layout Shells

Use different shells for staff operations and resident self-service while keeping shared visual language.

### Admin and Location Manager

- Classic left sidebar plus top bar, the "soft workspace" shell: the rail floats on the paper canvas in light mode and sits on surface 2° in dark mode.
- Sidebar: pinned at `20rem` from the `xl` breakpoint (80rem); below it the same rail opens as a `24rem` drawer. Width lives in `--sidebar-width` in `index.css` and must match the `xl:` classes in the shell components.
- Top bar: `64px` (`h-16`), with the search box and the user menu.
- Content padding: `32px` horizontal on desktop, `16px` on mobile.
- Data-heavy screens use the available width instead of a narrow column; sections that sit next to the rail use Tailwind container queries (`@container` and `@4xl:`), because viewport breakpoints misfire around `1024px` there.

### Front Desk / Security

Front desk uses the same admin shell with a reduced navigation and no manage actions (ADR 0035). There is no separate operations shell. Recepción (Visitantes, Paquetería) is a group inside the admin sidebar; the front desk landing is the admin Panel until a slimmer variant is needed.

### Resident Portal

- Use a simpler, lighter shell than the staff dashboard.
- Desktop can use a top header with compact navigation.
- Mobile can use drawer navigation or bottom navigation if the portal grows.
- Prioritize upcoming reservations, visitor pre-registrations, announcements, and household/unit information.

Authenticated app screens should not use marketing-style hero layouts.

## Typography

Use Inter as the primary UI font and JetBrains Mono for code-like values, IDs, and technical metadata. Serif fonts should not be used in the product UI.

Brand surfaces (the marketing site and the auth pages: login, select account) use the brand typography instead: Sora for display text (wordmark, headings, stat values) and Instrument Sans for body and controls. In the web app these are self-hosted via Fontsource and applied with the `font-display` / `font-brand` Tailwind utilities plus a scoped `--mantine-font-family` override — never globally. Behind the app shell only the wordmark and the location mark in the sidebar use `font-display`; everything else stays on Inter. Monospace (`font-mono`) is reserved for money amounts, ledger dates and timeline timestamps.

Typography should be practical and restrained. Avoid oversized headings inside authenticated app screens.

Starting scale:

- Page title: `24px / 32px`, weight `700`.
- Section title: `18px / 28px`, weight `700`.
- Card title: `15px` to `16px / 24px`, weight `700`.
- Body: `14px / 20px`, weight `400`.
- Resident-facing body copy may use `16px / 24px` where clarity is more important than density.
- Small text: `13px / 18px`, weight `400`.
- Table cell: `14px / 20px`.
- Table header: `12px / 16px`, weight `700`, uppercase optional.
- Button: `14px / 20px`, weight `600`.

Spanish labels can be longer than English. Avoid tiny fixed-width text buttons, allow wrapping where appropriate, and test labels in realistic Spanish copy.

Letter spacing should remain `0`.

## Radius and Elevation

Use a restrained radius and elevation system.

Radius (revised 2026-09-03, after the mockups settled on `14px` surfaces):

Three tiers only. Every rounded corner in the app is one of these; nothing is hand-typed.

| Tier | Value | Used for | In code |
| --- | --- | --- | --- |
| Surface | `14px` | cards, tables, KPI tiles, panels, banners, modals, popovers, the sidebar shell | Tailwind `rounded-surface`; Mantine `radius="lg"` |
| Inner | `10px` | nested cards, slot bands, list rows and tiles inside a surface, nav items | Tailwind `rounded-inner` |
| Control | `8px` | buttons, inputs, selects, search boxes, icon buttons, pager arrows | Mantine `md` (the theme default, no prop needed) |

Pills, badges, chips and avatars stay fully rounded.

Implementation:

- The two custom tiers are Tailwind theme tokens in `apps/web/src/index.css` (`--radius-surface`, `--radius-inner`), which generate the `rounded-surface` and `rounded-inner` utilities.
- Mantine's `lg` radius is remapped to `14px` in `apps/web/src/app/theme.ts` so `Modal`, `Skeleton`, `Paper` and friends match the Tailwind cards with `radius="lg"`. `md` stays `8px`.
- Do not use `rounded-lg`, `rounded-xl`, `rounded-2xl` or bracket values like `rounded-[14px]` for surfaces or inner elements; they drift (Tailwind `lg` is `8px`, Mantine `lg` was `16px`, mockups are `14px`). Shared components (`DataTable`, `StatCard`, `AppDrawer`, detail drawer parts) already carry the right tier, so prefer them over new wrappers.
- Skeletons standing in for a surface use `radius="lg"`; skeletons inside a drawer body use `md`.

Elevation:

- Level 0: flat page background.
- Level 1: card or panel with `1px` border and no shadow.
- Level 2: sticky top bar or raised panel with subtle shadow.
- Level 3: dropdown, popover, modal, or floating surface with shadow.

Use borders more often than shadows. Shadows should indicate meaningful elevation, not decorate ordinary panels.

## Status Colors

Status colors are the four semantic roles plus neutral gray. They help users scan tables, badges and drawers without making the interface loud.

Mapping used in the product:

| Role | Reservations | Movements (finances) | Staff and registry |
| --- | --- | --- | --- |
| `success` | approved (Confirmada) | paid, refunded | active |
| `warning` | pending | pending (Pendiente / Por pagar) | invitation pending |
| `info` | observed | held (En garantía), to refund (Por devolver) | — |
| `error` | rejected | — (voided is gray) | — |
| `gray` | cancelled, completed (derived) | retained, voided | deactivated, inactive |

Rules:

- Status pills are `StatusPill` from `components/ui/chips.tsx`, everywhere: tables, drawers, detail pages, dashboard panels. It is the outlined access chip (1px default border, body fill, 12px medium sentence case, never truncates) with the role color on the text only; `gray` means dimmed text, `teal` the interactive token. The outline carries the shape, so the pill never depends on a surface step and never collides with a group band, a hover or a cream panel. Neutral tags (location·role, confirmation kind, counts) use `AccessChip`, the same shape with dimmed text. Mantine `Badge` is reserved for counters (`variant="filled"`, the Por aprobar count) and the portal's own pills; the theme's `light`/`surface` Badge remap remains for those.
- Colored figures (amounts, KPI values) use the `--wa-*` tokens, not the badge tint variables.
- Amber is both accent and dark-mode warning, so a warning always carries text; badges never rely on color alone.
- Presentation rules for a status (label, color, allowed inline action) live in one module per feature (`movement-presentation.ts`, `reservation-presentation.ts`, `visit-presentation.ts`, `residents/presentation.ts`, `packages/presentation.ts`, `units/unit-presentation.ts`, `announcements/presentation.ts`) so a row, its drawer and the dashboard never disagree. No inline status→color ternaries in cells.
- Tables should remain readable in grayscale; color is secondary support.

## Buttons

Buttons should be predictable and restrained because users perform operational actions repeatedly.

Button types:

- Primary: main action on a screen or modal, such as `Registrar visitante`, `Guardar`, or `Crear reserva`.
- Secondary: safe alternate actions, such as `Cancelar`, `Ver detalles`, or `Exportar`.
- Ghost: low-emphasis toolbar and navigation actions.
- Destructive: delete, deactivate, reject, or cancel actions when irreversible or sensitive.
- Icon button: edit, delete, search, filter, download, and more menu actions.

Rules:

- Use only one primary button per main area or modal.
- Destructive buttons should not look like primary buttons.
- Use icons for common tool actions, especially in dense tables.
- Spanish labels should fit naturally and should not be forced into tiny fixed-width buttons.
- Async actions require loading states.
- Disabled states should explain themselves when the reason is not obvious.

Sizes (Mantine scale, unchanged):

- Default (`md`): `42px`. Used for drawer footers and action rows.
- `sm`: `36px`. Used for page-header actions and toolbar buttons.
- `xs` and `compact-xs`: table row actions and text-link tertiaries.
- Icon buttons: `ActionIcon` at `32px`, or `size="input-sm"` (`36px`) when it sits next to an input.
- Radius: `8px` (Mantine `md`, the control tier).

Color:

- Primary: `color="accent"` (amber, dark text). One per screen or overlay.
- Secondary: `variant="default"` (bordered, surface; hovers to surface 2° so it stays visible on the paper canvas). Secondary buttons stay neutral in both schemes — the mockups never fill them with teal; amber is the only filled button color, one per screen.
- Tertiary: `variant="subtle"`, usually `size="compact-sm"` and dimmed, for reverts and low-emphasis links.
- Destructive: `color="error"` only inside a confirmation dialog; in the action row a destructive move is a `default` button that opens the confirmation.

Action rows in drawers: one row of stretched `md` buttons (primary accent, the rest default), tertiaries below as text buttons. Both detail drawers follow this.

Touch targets:

- On a coarse pointer (`@media (pointer: coarse)`, a finger regardless of screen size) every Mantine button and icon button below the default size grows to a `44px` minimum with wider padding. This is one rule in `index.css` on `.mantine-Button-root` and `.mantine-ActionIcon-root`; nothing per page.
- Custom controls (chip rows, sort headers, filter-chip remove, text links that act) carry Tailwind's `pointer-coarse:min-h-11` and get more gap between neighbours with `pointer-coarse:gap-3`.
- Inputs follow the same rule: 44px tall and 16px text on a coarse pointer (below 16px, iOS Safari zooms the page on focus). Dropdown options grow to a 44px row, switches and checkboxes step up one size, segmented controls get a 44px minimum. All of it lives in the same `index.css` block.
- Desktop with a mouse is unchanged. Verify in the browser with device emulation; jsdom cannot evaluate media queries.

## Forms

Forms should be clear, predictable, and resistant to data-entry mistakes.

Rules:

- Use single-column forms by default.
- Use two columns only for short, related fields on desktop, such as first/last name or date/time.
- Put labels above inputs.
- Do not rely on placeholders as labels.
- Required fields should be clear but not visually noisy.
- Helper text should be short and practical.
- Validation errors should appear directly under the field.
- Long forms may use sticky bottom actions when useful.
- Use drawers for quick create/edit flows where surrounding context should remain visible.
- Use full pages for complex setup flows such as CSV import preview.

Defaults:

- Inputs are Mantine `md` (`42px`), labels Mantine `sm`.
- Field gap in drawers: `20px` (the `AppDrawerBody` grid); two short related fields share a row with `sm:grid-cols-2`.
- Drawer width: `620px` for every `AppDrawer`; below `64rem` (tablets and phones) the sheet takes the full viewport.
- Dropdowns inside an `AppDrawer` (Select, MultiSelect, TagsInput) render in place, not in the body portal: `AppDrawer` wraps its children in a theme that sets `comboboxProps.withinPortal: false`. Chrome on touch repaints the fixed sheet from a stale frame when a dropdown layer appears outside it, which looks like the drawer closing and reopening. Keep the portal everywhere else (table filters, popovers).
- Forms use `react-hook-form` with a `zod` resolver (ADR 0009). Schema messages are i18n keys; server `422` errors land under their field through `submitHandlingServerErrors`, and anything unmatched goes to a root `Alert`.
- Plain `rows` on `Textarea`, never `autosize` (it needs layout APIs jsdom lacks). Note fields use three rows everywhere.
- Money inputs: `MoneyInput` (`components/ui/money-input.tsx`) — a `NumberInput` with "S/" as a dimmed `leftSection`, two decimals, `thousandSeparator=" "`; the field shows soles but form state and the API hold integer cents (`*_minor`).
- Dates: `DateField` from `components/ui/date-field.tsx` (Mantine `DatePickerInput` from `@mantine/dates`, Spanish, Monday-first, calendar icon, long value like "5 de octubre de 2026"). Values are `YYYY-MM-DD` strings or `''`, never `Date` objects. Bounds and closed days go through `minDate` / `maxDate` / `excludeDate`. Day buttons are labelled by ISO date, so tests pick a day with `pickDate` from `lib/test-dates.ts`. No native `type="date"` inputs. Times that are typed (quiet hours, announcement hour) stay native `type="time"`.
- Booking days (ADR 0043): a reservation is a whole day, so there is no time picker anywhere. The staff drawer books on a `DateField` with the amenity's closed weekdays excluded and a one-line `approved / capacity` hint under it; the portal books on a Mantine `MiniCalendar` seven-day strip where closed, past and full days are disabled through `getDayProps` and a full day says "Cupo lleno" under the strip. Open weekdays are seven `Checkbox`es in the amenity form (Monday first); weekday keys, `isOpenOn` and `openDaysLabel` ("Todos", "L–V", "L, Mi, V") live in `lib/open-days.ts` so both surfaces share them.

## Tables

All lists use the shared `DataTable` in `components/table/data-table.tsx`: TanStack Table as the engine, the design system as the skin. It owns the surface card (`rounded-surface`), the toolbar strip, the header band and the footer pager; the page owns every data concern and passes results in.

Rules:

- Header cells: `12px`, uppercase, wide tracking, dimmed. Sortable headers (column `meta.sortKey`) are buttons cycling ascending, descending, cleared, with an arrow only while active.
- Rows: Mantine `Table` with `horizontalSpacing="lg"`, `verticalSpacing="sm"`, hover highlight, no zebra striping.
- **Never stack rows into mobile cards.** Narrow viewports scroll the table sideways inside the card; headers stay. Columns can drop below a breakpoint with `meta.hideBelow`.
- Clickable rows (`onRowClick`) get the pointer and a hover background; the selected row (`selectedId`) shows a `2.5px` left bar in the interactive teal while its drawer is open.
- Row actions: prefer opening the row's drawer over inline buttons. When an inline action exists, it is the single forward move; everything else lives in the drawer.
- Server-side pagination, filtering and sorting (ADR 0011); all of it lives in the URL through the route's `validateSearch` schema, so bookmarks and back navigation work.
- Toolbar: `SearchInput` (applies on Enter or blur), `FilterButton` popover with the configured filters, `FilterChips` echoing applied filters as removable pills. Quick filters that are not "filters" (status or direction chip rows, a month navigator) sit above the card.
- Empty states are plain text inside the card, with different copy for "nothing this period" and "nothing matches the filter".
- Footer pager: "Mostrando a–b de n" and two `ActionIcon` arrows. No "load more".

Typical toolbar pattern:

```txt
[Buscar…] [Filtros ●2] [Categoría: Agua ×] [Categoría: Multa ×]
```

## Empty States

Empty states should be plain, operational, and action-oriented.

Pattern:

```txt
Title: No hay visitantes esperados para hoy
Description: Los visitantes pre-registrados apareceran aqui cuando un residente los agregue.
Action: Registrar visitante
```

Rules:

- Avoid large illustrations in operational tables.
- A small icon is acceptable when it improves scanning.
- Use one primary action at most.
- Spanish copy should be direct and human.
- Setup screens may include stronger calls to action, such as CSV import.

## Modals, Drawers, and Full Pages

Use overlays intentionally.

Patterns:

- Modal: confirmations and small focused forms.
- Drawer: quick create/edit flows where the user should keep table or page context.
- Full page: complex workflows, multi-step flows, CSV import preview, reservation calendar/details, and location setup.
- Confirmation dialog: destructive or irreversible actions.

Patterns in use:

- **Form drawer** (`AppDrawer` + `AppDrawerBody` + `AppDrawerFooter`, `620px`, full width below `64rem`): create and edit flows — staff access, location, amenity, new reservation, record movement. Footer: `Cancelar` (default) and the accent submit.
- **Detail drawer** (same `AppDrawer`, pieces from `components/ui/detail-drawer-parts.tsx`): the row's home. Inner cards inside a drawer (unit list, portal block, member header, slot band) are filled with `--wa-surface-2` and bordered, never border-only on the drawer surface. Sections in order: header value and status badge, `DrawerFacts` (uppercase label over value, two columns), `DrawerSection` rules, `DrawerTimeline` (Historial, newest first; derived events drawn with a hollow dot and dimmed), Acciones with one optional note field and the action row. Footer: only `Cerrar`. Used for movements and reservations; deep-linked by a URL param (`movement`, `reservation`).
- **Confirmation** (`ConfirmDialog`): irreversible moves only — void, retain, cancel a reservation. Names the consequence, `Cancelar` + `Confirmar` in `error`.
- **Small modal**: a prompt that needs one field before acting (the queue's observe/reject note).
- **Bottom sheet** (`BottomSheet` in `components/ui/bottom-sheet.tsx`, portal only, Portal 02e): the phone-side overlay for lists, details, short forms and confirmations. Chrome: grab handle, no close button, `20px` shoulders, top border, upward shadow, dark scrim, `16px` side padding matching the page. Every sheet caps at `60dvh`: header and footer fixed, body scrolls. Header: title, up to two dimmed `lines`, optional `pill` on the right (status lives here, not in the body). Body parts: `SheetTiles`/`SheetTile` (filled `--wa-surface-2` tiles, two columns, `wide` for one), `SheetNote` (tinted label with the "i" circle), `DrawerTimeline` reused. Footer: `SheetAction` with the one action and its centered hint. `ConfirmSheet` stacks on the sheet that opened it and repeats the action label on its red button; the portal never uses `ConfirmDialog`.
- **Full page**: CSV import preview, location detail with tabs.

Rules:

- Do not use nested modals. A `ConfirmSheet` over a `BottomSheet` is the one allowed stack, on the portal.
- Keep destructive actions visually distinct.
- Long overlay forms should have clear sticky actions when scrolling is likely.

## Product Copy

Use clear, neutral Latin American Spanish for v1.

Voice:

- Direct, calm, and practical.
- Human but not playful.
- Operational rather than legalistic or bureaucratic.
- Avoid Spanglish.
- Avoid region-specific terms until a target country is chosen.

Label guidance:

- Use sentence case for most UI labels.
- Use verbs for actions.
- Keep navigation labels short.
- Prefer common product terms over administrative jargon.

Good examples:

```txt
Registrar visitante
Crear reserva
Invitar residente
Marcar como pagado
Exportar CSV
Pendiente de aprobacion
```

Avoid:

```txt
Crear Nuevo Registro de Visitante
Administrar Amenidad Compartida
Aprovisionar Usuario
```

## Icons

Use `@solar-icons/react` (Solar icon set) for product icons. Verify a name exists in the package's `dist/types` before importing; never fall back to text glyphs like `‹` or `›` for controls (the row chevron `›` in tables is a decorative hint, not a control).

Rules:

- Icons support scanning, not decoration: navigation, table actions, empty states, key buttons.
- Icon-only buttons require an `aria-label`.
- Never the only status indicator; pair with text.

Navigation mapping in use:

- Panel: `Widget`. Personas: `UsersGroupRounded`. Unidades: `KeySquare`. Reservas: `Calendar`. Finanzas: `Wallet`. Anuncios: `Speaker`. Visitantes: `UserCheckRounded`. Ubicaciones: `Buildings2`. Actividad: `ClipboardList`. Configuración: `Settings`. Búsqueda: `Magnifier`.
- Controls: `Add` on create buttons, `AltArrowLeft`/`AltArrowRight` on pagers and month or week navigators, `AltArrowUp`/`AltArrowDown` as sort indicators, `Filter` on the filters button, `Close` on chips, `InfoCircle` on informational banners, `ArrowDown` as the expense mark.

## Dashboard Metrics

Metric tiles use `StatCard` in `components/ui/stat-card.tsx`: label, value, subline, optional `tone` (`success`, `error`, `accent`) for the value, optional `aside` after the value, optional `highlighted` border and dot for a tile that needs attention.

Rules:

- **Tiles are statistics only.** Values, counts, breakdowns by category, comparisons against the previous period. Never an interpretive sentence or a claim the system cannot verify ("Se cubre con cuotas de mantenimiento" was removed for this reason).
- At most four in a row (`grid-cols-4` from the `@4xl` container breakpoint, two on tablets, one on phones).
- Value in `24px` bold with the role token color; label `14px` dimmed; subline `14px` dimmed.
- Colored values use `--wa-*` tokens, not badge tint variables.

## Accessibility

Accessibility is a baseline requirement.

Requirements:

- Meet WCAG AA contrast for text and controls.
- Forms, menus, dialogs, tables, and drawers must be keyboard navigable.
- Focus states must be visible and use the ring color.
- Icon-only buttons require `aria-label` and tooltip.
- Status badges must include text, not color alone.
- Modals and drawers must trap focus and restore focus on close.
- Error messages must be associated with their fields.
- Tables need clear headers and accessible pagination.
- Avoid text smaller than `12px`.

## Responsive Behavior

Desktop is the primary target for Admin and Front Desk workflows. Mobile is required for the Resident Portal and should support basic staff workflows.

Use Tailwind breakpoints:

```txt
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

Rules:

- Desktop admin screens should show the sidebar.
- Tablet layouts may collapse the sidebar.
- Mobile layouts should use drawer navigation or bottom navigation depending on the surface.
- Tables never squeeze and never collapse into stacked cards: they scroll horizontally inside their card, keep their headers, and drop low-priority columns with `meta.hideBelow`.
- Sections beside the sidebar use container queries (`@container`, `@4xl:`) instead of viewport breakpoints, which misfire around `1024px` next to the rail.
- Critical actions must remain reachable without horizontal scrolling.
- Front Desk workflows should work well on tablet.
- Resident Portal should feel natural on phone.
- Long Spanish labels should wrap cleanly.

## Component Inventory

What exists today, and where:

| Component | Location | Notes |
| --- | --- | --- |
| App shell, sidebar, top bar, location switcher, user menu | `components/layout/shared/` | soft workspace rail, container-query aware |
| `DataTable` + `SearchInput`, `FilterButton`, `FilterChips`, `buildFilterChips`, `sort.ts` | `components/table/` | server-driven, sortable headers, row click and selection |
| `StatCard` | `components/ui/stat-card.tsx` | statistical tiles |
| `AppDrawer`, `AppDrawerBody`, `AppDrawerFooter` | `components/ui/app-drawer.tsx` | form and detail drawers |
| `DrawerFacts`, `DrawerFact`, `DrawerSection`, `DrawerTimeline`, `ConfirmDialog` | `components/ui/detail-drawer-parts.tsx` | shared by every detail drawer |
| `TintChip`, `AccessChip` | `components/ui/chips.tsx` | non-truncating status and access pills |
| `FormTextInput`, `FormPasswordInput`, `NullableTextInput` | `components/ui/form-fields.tsx`, `features/registry/` | react-hook-form wired inputs |
| Toasts (`notifySuccess`, `notifyError`, `notifyWarning`) | `lib/notify.tsx` + `.wa-toast` in `index.css` | card chrome, tinted icon chip |
| Confirmations (`ConfirmModal`, `ConfirmDialog`) | `components/ui/confirm-modal.tsx` | mockup 06d: no header, tinted icon chip, display title, facts panel, warning callout, footer bar with Cancelar as text and a tinted-red confirm |
| Unit label (`formatUnitLabel`) | `features/units/unit-label.ts` | the one way a unit is written inline: "Torre A / 402", or "402" for a single unnamed tower; matches `Unit::label()` on the API. Tables, chips, drawers and subtitles all go through it; the Unidades page groups by tower instead |
| `PagePlaceholder` | `components/ui/page-placeholder.tsx` | route stubs |

Not built, and not currently planned: breadcrumbs, a date range picker, a time-based schedule grid (`@mantine/schedule` was removed twice; the reservations view is the week board, a plain table of amenity rows by day).

## Token Implementation Strategy

Semantic tokens are the source of truth, bridged into Tailwind and Mantine:

```txt
docs/colorschema.md (roles)
  -> apps/web/src/index.css        --wa-* CSS variables (light on :root, dark on [data-mantine-color-scheme='dark']); @theme radius and font tokens
  -> apps/web/src/app/theme.ts     Mantine scales (teal, accent, success, warning, error, info, petroleum dark), primaryShade { light: 6, dark: 5 }, radius scale, cssVariablesResolver for body/border/dimmed/anchor
```

Rules:

- Feature components use `var(--wa-*)` or `var(--mantine-color-*)` in Tailwind classes, or semantic Mantine color names. No raw hex outside `index.css`, `theme.ts` and the seeders' image generation.
- No `light-dark()`; dark values swap through the color-scheme attribute block.
- Radius comes from the three-tier scale above; spacing from Tailwind's default scale; fonts from the `font-display` / `font-brand` utilities on brand surfaces only.
- Both color schemes must work for every new token: add the light value on `:root` and the dark value in the dark block in the same change.

## Mantine Defaults

Define common Mantine component defaults globally through `createTheme` so forms, buttons, modals, drawers, and notifications stay consistent.

Defaults set in `theme.ts`:

- `primaryColor: "teal"`, `primaryShade: { light: 6, dark: 5 }`, `autoContrast: true` so accent buttons get dark text without per-button props.
- Radius scale: `md` `8px` (controls), `lg` `14px` (surfaces), see Radius.
- Font sizes and spacing scales extended with `2xl`–`5xl` and `3xs`–`3xl` steps.
- `Select`: check icon on the right. `Paper` and `Card` defaults exist but the app builds surfaces with Tailwind classes instead.
- Body, default border, dimmed and anchor colors are pinned through `cssVariablesResolver` («papel, no blanco»).
- Modal: `radius="lg"`, centered for confirmations. Drawer: right side, `620px` on laptops and up, full viewport below `64rem`. Notifications: top-right, card chrome via `.wa-toast`.

Do not use Mantine layout primitives such as `Box`, `Stack`, or `Grid` for page layout. Use semantic HTML and Tailwind classes for layout.

`@mantine/modals` is installed and its provider mounted, but confirmations in the product use the explicit `ConfirmDialog` component so they render inside the feature's tree and tests. Complex create and edit flows use `AppDrawer`; nothing goes through the modals manager.

Use `@mantine/dropzone` for file upload surfaces:

- Amenity photo uploads.
- CSV import uploads.

Dropzones should show accepted file types, size limits, rejection feedback, and upload/processing state. Backend validation remains authoritative.

## Page Templates

Use repeatable page templates for common product surfaces.

### List Management Page

Used for residents, units, vehicles, amenities, announcements, and similar records.

```txt
PageHeader
Toolbar/filter row
DataTable
Pagination
Drawer or modal for create/edit
```

### Operational Dashboard Page

Used for Account Admin, Location Manager, and Front Desk dashboards.

```txt
PageHeader
Key actions or search
Small metric row
Priority panels/lists
Activity or upcoming items
```

### Detail Page

Used for unit, resident, amenity, reservation, and similar detail views.

```txt
PageHeader with actions
Summary section
Tabs or sections
Related tables/activity
```

### Setup / Import Flow

Used for CSV import and other setup workflows.

```txt
Step header
Upload
Validation status
Preview table
Confirm import
Completion summary
```

### Resident Portal Page

Resident-facing pages should be simpler, less dense, and action-focused.

```txt
PageHeader
Primary resident action
Relevant upcoming items
Recent announcements or status
```

## Branding

The product is **Wasiy**. The wordmark is set in Sora (`font-display`) in the sidebar and on the auth screens; the location mark in the switcher is a two-letter monogram on the secondary teal. Final app icon, favicon and email header mark are still pending.

## Visual Assets

Use visual assets sparingly inside the authenticated app.

Rules:

- Do not use decorative stock photos in the dashboard.
- Amenity photos should be real user-uploaded content.
- Empty states should use small icons rather than illustrations.
- Resident Portal may show amenity photos when browsing or reserving shared spaces.
- Login screens may use a subtle branded panel or abstract pattern, but should avoid generic real-estate stock imagery.

## Authentication Screens

Authentication screens should be simple, calm, and Spanish-first.

Screens:

- Login.
- Forgot password.
- Reset password.
- Accept staff invite.
- Accept resident invite.

Rules:

- Use a clean centered auth panel or restrained split layout.
- Use the Puerto palette with the brand fonts (Sora display, Instrument Sans body), scoped to these screens.
- Avoid marketing-heavy hero layouts.
- Avoid large generic real-estate imagery.
- Include provisional product name or mark.
- Keep forms compact and easy to scan.
- Resident invitation and claim-account flows should feel guided and reassuring.

## Reservation Week List

The manager view is the day-grouped week list (`features/reservations/reservation-week-list.tsx`) on the shared `DataTable`: day bands through `groupBy` on `reserved_on` ("Hoy · viernes 12 de septiembre"), columns amenity (with the per-amenity accent bar in the cell), unit, resident (`hideBelow: md`), status pill and the trailing chevron, plus a toolbar with search, status chips (Todas · Pendientes n · Confirmadas · Completadas) and an amenity filter. Bookings carry no time (ADR 0043), so there is no time column; two rows for one amenity under a day band are a conflict at a glance. Rows open the reservation drawer and the open row shows the selected bar. The week pager sits above the list and anchors on the URL `date` param.

## Loading and Async States

Use loading states that preserve layout stability.

Patterns:

- Initial app boot: centered loader or minimal splash.
- Table loading: skeleton rows.
- Metric loading: skeleton metric blocks.
- Page panel loading: skeleton panels.
- Form submit: button loading state.
- Small controls such as filters: inline loading when needed.
- CSV import and export jobs: explicit status states instead of indefinite spinners.

Queued job statuses:

- Pending.
- Processing.
- Ready.
- Failed.

Rules:

- Avoid full-screen loading except during initial auth/app boot.
- Keep loaded layout dimensions stable to prevent shifting.
- Long-running operations should show status and recovery actions.

## Error and Destructive States

Error states should be clear, recoverable where possible, and close to the affected UI.

Patterns:

- Validation errors: inline under the relevant field.
- Recoverable fetch or action failures: page-level or panel-level error banner.
- Successful actions and minor failures: toast notification.
- Destructive actions: confirmation dialog.
- CSV import failure: page-level error with row-level errors and downloadable error report when possible.

Rules:

- Destructive confirmations should name the affected record.
- Use explicit confirmation text only for truly dangerous actions.
- Rejected reservations should require a short reason so the resident has context.
- Destructive visual treatment should be distinct from primary action styling.

## Toasts and In-App Feedback

Use toasts for short-lived feedback after actions. Do not use toasts as the only place for important workflow information.

Patterns:

- Success and info toasts may auto-dismiss (Mantine default, 4 s).
- Errors stay 8 s (`ERROR_TOAST_AUTO_CLOSE` in `app/query-client.ts`).
- **One error toaster.** A failed mutation is toasted by the query client's mutation cache, titled "No se pudo completar la acción". Feature code never calls `notifyError` from a mutation's `onError`: the cache handler runs as well and the failure shows twice. A form that renders the error inline opts out with `meta: { suppressErrorNotification: true }`. Success toasts stay local, since only the caller knows what happened.
- Long-running jobs should show on-page status, not only a toast.
- Desktop placement: top-right.
- Mobile placement: top or bottom safe area depending readability and Mantine behavior.

Copy examples:

```txt
Visitante registrado
Reserva aprobada
Cambios guardados
Exportacion en proceso
No se pudo guardar. Intentalo nuevamente.
```
