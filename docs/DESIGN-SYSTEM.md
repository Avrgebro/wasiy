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

## Working Color Direction

The working palette is a restrained violet system with soft lavender surfaces and a pale blue accent. The provided token set is color inspiration only; spacing, radius, shadows, typography, and component behavior are defined by this design system rather than inherited wholesale from the source palette.

Because violet can quickly feel decorative or generic SaaS, it should be used intentionally: primary actions, focus states, selected controls, charts, and small accents. Large dashboard surfaces should remain neutral and quiet.

Use the provided hex token set as the starting point for implementation.

Key usage guidance:

- `background` is the app background.
- `card` is the primary panel and table surface.
- `foreground` is the main text color.
- `muted` and `muted-foreground` are for secondary surfaces and supporting text.
- `primary` is for primary actions, focus rings, and the most important active states.
- `accent` is preferred for subtle selected navigation states.
- `destructive` is reserved for destructive actions and critical errors.
- Sidebar selected items should use `sidebar-accent`, not a saturated primary fill.

The current visual preview lives at `docs/design-palette-preview.html`.

### Light Theme Tokens

```css
--background: #f5f5ff;
--foreground: #2a2a4a;
--card: #ffffff;
--card-foreground: #2a2a4a;
--popover: #ffffff;
--popover-foreground: #2a2a4a;
--primary: #6e56cf;
--primary-foreground: #ffffff;
--secondary: #e4dfff;
--secondary-foreground: #4a4080;
--muted: #f0f0fa;
--muted-foreground: #6c6c8a;
--accent: #d8e6ff;
--accent-foreground: #2a2a4a;
--destructive: #ff5470;
--destructive-foreground: #ffffff;
--border: #e0e0f0;
--input: #e0e0f0;
--ring: #6e56cf;
--chart-1: #6e56cf;
--chart-2: #9e8cfc;
--chart-3: #5d5fef;
--chart-4: #7c75fa;
--chart-5: #4740b3;
--sidebar: #f0f0fa;
--sidebar-foreground: #2a2a4a;
--sidebar-primary: #6e56cf;
--sidebar-primary-foreground: #ffffff;
--sidebar-accent: #d8e6ff;
--sidebar-accent-foreground: #2a2a4a;
--sidebar-border: #e0e0f0;
--sidebar-ring: #6e56cf;
```

## Interface Density

Use adaptive density.

Admin and Front Desk screens should be compact but readable because they support repeated operational work. Resident Portal screens should be more comfortable and clearer because residents use them less frequently and need fewer dense tables.

Starting defaults:

- Desktop page padding: `24px`.
- Mobile page padding: `16px`.
- Panel and card padding: `16px`.
- Table row height: `44px` to `48px`.
- Input height: `40px`.
- Primary button height: `40px`.
- Compact icon button size: `32px` to `36px`.
- Section gap: `24px`.
- Field gap: `12px` to `16px`.

Density guidance:

- Operational tables may be compact by default.
- Forms and destructive actions need enough spacing to reduce mistakes.
- Mobile layouts should prioritize clarity over row count.

## Layout Shells

Use different shells for staff operations and resident self-service while keeping shared visual language.

### Admin and Location Manager

- Use a classic left sidebar plus top bar.
- Sidebar width: about `260px` on desktop.
- Top bar height: `56px` to `64px`.
- Data-heavy screens should use the available width instead of a narrow content column.
- Content padding: `24px` desktop, `16px` mobile.
- Mobile should replace the persistent sidebar with drawer navigation.

### Front Desk / Security

- Use a simplified operations shell.
- Prioritize quick search, expected visitors, recent check-ins, and check-in actions.
- Navigation may use a narrower sidebar or rail if the workflow stays small.
- Avoid burying visitor check-in behind deep navigation.

### Resident Portal

- Use a simpler, lighter shell than the staff dashboard.
- Desktop can use a top header with compact navigation.
- Mobile can use drawer navigation or bottom navigation if the portal grows.
- Prioritize upcoming reservations, visitor pre-registrations, announcements, and household/unit information.

Authenticated app screens should not use marketing-style hero layouts.

## Typography

Use Inter as the primary UI font and JetBrains Mono for code-like values, IDs, and technical metadata. Serif fonts should not be used in the product UI.

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

Radius:

- Default radius: `8px`.
- Small controls: `6px`.
- Pills and badges: fully rounded.
- Modals, drawers, and panels: `8px`, with `10px` as the practical maximum.
- Avoid large rounded cards because they can make operational software feel less serious.

Elevation:

- Level 0: flat page background.
- Level 1: card or panel with `1px` border and no shadow.
- Level 2: sticky top bar or raised panel with subtle shadow.
- Level 3: dropdown, popover, modal, or floating surface with shadow.

Use borders more often than shadows. Shadows should indicate meaningful elevation, not decorate ordinary panels.

## Status Colors

Use muted classic status colors separate from the brand palette. Status colors should help users scan tables, badges, alerts, and workflow states without making the interface feel loud.

Status categories:

- Success: approved, paid, ready, active, completed.
- Warning: pending, waiting, needs review, incomplete.
- Danger: rejected, failed, overdue, cancelled, destructive.
- Info: expected, scheduled, in progress, service-related.
- Neutral: inactive, draft, archived, not applicable.

Usage guidance:

- Use soft backgrounds with darker text for badges.
- Avoid using saturated fills except for destructive confirmations or strong alerts.
- Do not use the purple primary color for every status.
- Status labels must include text, not color alone.
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

Default sizes:

- Default button height: `40px`.
- Compact button height: `32px` to `36px`.
- Icon button size: `32px` to `36px` square.
- Radius: `6px` to `8px`.

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

- Label: `13px`, medium weight.
- Input height: `40px`.
- Field gap: `12px`.
- Group gap: `20px` to `24px`.
- Normal form max width: `640px`.
- Modal form width: `520px` to `720px`.

## Tables

Tables should be dense, bordered, and highly scannable.

Rules:

- Header rows should be subtle, not visually heavy.
- Row height: `44px` to `48px`.
- Use sticky or persistent table controls above important tables.
- Common filters should stay visible.
- Advanced filters can live in a drawer or menu.
- Use badges for status.
- Use icon buttons or a row action menu for secondary actions.
- Use empty states with a clear next action.
- Use server-side pagination, filtering, and sorting.
- Prefer row hover over zebra striping.
- Avoid wrapping every table in a decorative card when the whole page is already a data surface.

Typical toolbar pattern:

```txt
[Search...] [Status filter] [Date range] [More filters]        [Export] [Create]
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

Examples:

- Create visitor walk-in: drawer.
- Edit resident contact info: drawer.
- Approve or reject reservation: modal or drawer depending on required detail.
- CSV import preview: full page.
- Amenity creation with photos and rules: full page or large drawer.
- Delete or deactivate resident: confirmation modal.

Rules:

- Do not use nested modals.
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

Use `lucide-react` for product icons.

Rules:

- Icons should support scanning, not decorate.
- Use icons in navigation, table actions, empty states, and key buttons.
- Avoid custom SVG icons unless the library lacks an important concept.
- Icon-only buttons require tooltips and accessible labels.
- Avoid using icons as the only status indicator; pair status with text.

Suggested mapping:

- Visitors: `UserRoundCheck` or `ClipboardCheck`.
- Residents: `UsersRound`.
- Units: `Building2` or `Home`.
- Reservations: `CalendarCheck`.
- Amenities: `Landmark` or context-specific icons like `Dumbbell`.
- Vehicles: `Car`.
- Announcements: `Megaphone`.
- Activity log: `ListChecks`.
- Exports: `Download`.
- Settings: `Settings`.
- Search: `Search`.
- Filter: `SlidersHorizontal`.
- More actions: `Ellipsis`.

## Dashboard Metrics

Use metric blocks sparingly. Metrics should answer operational questions, not decorate the dashboard.

Rules:

- Do not use decorative nested cards.
- Keep metric cards compact.
- Group metrics close to the workflow they affect.
- Front Desk screens should prioritize quick search and check-in actions over metric cards.
- Use at most four metrics in one row.

Suggested metrics:

- Visitantes hoy.
- Reservas pendientes.
- Invitaciones sin reclamar.
- Unidades activas.

Defaults:

- Metric card height: `88px` to `112px`.
- Value size: `24px` to `30px`.
- Label size: `13px`.

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
- Tables should not simply squeeze; use horizontal scroll, column priority, or mobile list alternatives.
- Critical actions must remain reachable without horizontal scrolling.
- Front Desk workflows should work well on tablet.
- Resident Portal should feel natural on phone.
- Long Spanish labels should wrap cleanly.

## V1 Component Inventory

The design system should cover these reusable components and patterns for v1:

- `AppShell`
- `SidebarNav`
- `TopBar`
- `PageHeader`
- `Breadcrumbs`
- `MetricCard`
- `DataTable`
- `TableToolbar`
- `StatusBadge`
- `FilterBar`
- `SearchInput`
- `EmptyState`
- `FormSection`
- `ConfirmDialog`
- `DrawerForm`
- `ModalForm`
- `Toast` / `Notification`
- `DateRangePicker`
- `FileUpload`
- `CSVImportPreview`
- `ActivityTimeline`
- `ReservationCalendar` or `ReservationSchedule`

Mantine should provide primitives where useful, but these should become Wasiy-specific wrappers or patterns when they encode product behavior, layout, copy, or accessibility rules.

## Token Implementation Strategy

Use semantic Wasiy tokens as the source of truth, then bridge them into Tailwind and Mantine.

```txt
Wasiy semantic tokens
  -> CSS variables
  -> Tailwind theme utilities
  -> Mantine theme adapter
```

Rules:

- Product components should use semantic tokens, not raw hex values.
- Tailwind layout classes should reference semantic color names like `bg-background`, `text-foreground`, and `border-border`.
- Mantine components should receive matching colors, radius, typography, and component defaults through `createTheme`.
- Do not use Mantine default color values directly unless mapped to Wasiy tokens.
- Do not hard-code hex values inside feature components.
- Status colors should get semantic tokens such as `success`, `warning`, `info`, `danger`, and `neutral`.

Suggested files:

```txt
apps/web/src/styles/tokens.css
apps/web/src/styles/app.css
apps/web/src/app/mantine-theme.ts
```

## Mantine Defaults

Define common Mantine component defaults globally through `createTheme` so forms, buttons, modals, drawers, and notifications stay consistent.

Initial defaults:

- Button: medium radius, `40px` default height, weight `600`.
- TextInput, Select, and Textarea: medium radius, `40px` input height, `13px` labels, consistent error styling.
- Modal: medium radius; centered for confirmations; avoid centered layout for larger workflows when it hurts usability.
- Drawer: right-side placement; responsive width, typically `520px` to `720px`.
- Notifications: top-right on desktop; success and info notifications may auto-close.

Do not use Mantine layout primitives such as `Box`, `Stack`, or `Grid` for page layout. Use semantic HTML and Tailwind classes for layout.

Use `@mantine/modals` for global confirmation dialogs and simple context modal flows:

- Deactivate resident.
- Cancel reservation.
- Delete amenity photo.
- Confirm sensitive fee/deposit status changes when needed.

Do not use the modals manager as a dumping ground for complex forms. Complex create/edit flows should use explicit Wasiy `ModalForm` or `DrawerForm` wrappers.

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

The product name is still pending, so branding should remain provisional.

Rules:

- Do not create a final logo until the product name is chosen.
- Use a simple wordmark placeholder in the sidebar and top bar.
- A small abstract building/unit mark is acceptable only as a temporary app mark.
- Avoid investing in final brand assets before naming is resolved.

Future brand assets:

- Wordmark.
- App icon.
- Favicon.
- Sidebar collapsed mark.
- Email header mark.

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
- Use the violet palette subtly.
- Avoid marketing-heavy hero layouts.
- Avoid large generic real-estate imagery.
- Include provisional product name or mark.
- Keep forms compact and easy to scan.
- Resident invitation and claim-account flows should feel guided and reassuring.

## Reservation Schedule UI

Use an agenda-first reservation interface for v1.

Patterns:

- Resident reservation flow: date picker plus available time slots.
- Manager view: agenda/list by date and amenity.
- Front Desk view: today's schedule list.
- Full month calendar grid is optional later.

Amenity booking should focus on available slots and operational clarity rather than dense calendar browsing.

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

- Success and info toasts may auto-dismiss.
- Important errors should stay longer or require dismissal.
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
