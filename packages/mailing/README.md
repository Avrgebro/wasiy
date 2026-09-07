# @wasiy/mailing

Email templates for the Laravel API, authored with [Maizzle 6](https://maizzle.com)
and compiled to Blade. Same setup as the EPP mailing package.

## Commands

From the repo root:

- `pnpm build:mail` compiles `emails/**/*.vue` into
  `apps/api/resources/views/mail/maizzle/<name>.blade.php` using
  `maizzle.config.production.ts`. Commit the output: the API deploys on Forge
  without Node.
- `pnpm dev:mail` starts the preview server with hot reload, using the base
  `maizzle.config.ts` and the images under `public/`.

Maizzle empties its output folder on every build, so never hand-write files in
`views/mail/maizzle/`. Hand-authored Blade mail stays directly under `views/mail/`.

Render a compiled template from a notification with
`(new MailMessage)->view('mail.maizzle.<name>', [...])`, or from a Mailable with
`new Content(view: 'mail.maizzle.<name>', with: [...])`.

## Brand

Start every email from `<WasiyLayout>` (in `components/`, auto-imported). It
sets `lang="es"`, the cream page background and loads Sora and Instrument Sans
from Google Fonts. Brand tokens live in `tailwind.css` as a Tailwind `@theme`
block mirrored from `apps/marketing/src/layouts/Layout.astro` (`bg-bg`,
`text-ink`, `bg-teal`, `bg-gold`, `font-sora`, ...). Keep the two in sync when
the site palette changes.

Maizzle's Layout compiles exactly one Tailwind `<style>`. Adding a second one
(a `<style>` in a slot or component) silently breaks utility ordering, which
showed up as the Container losing `mx-auto`. So `maizzle.config.ts` appends
`tailwind.css` into that single import from the `afterRender` hook instead.
Never add a Tailwind `<style>` to a template.

`emails/example.vue` is the reference template and follows the Maizzle starter
skeleton: one centered Container with a teal header Section (mark, wordmark,
kicker, title), a white body Section (greeting, intro, label/value Rows, gold
action, footnote) and the shared `<WasiyFooter />` (mark, tagline, contact
line). Its Blade variables match
`ResidentAlertNotification`.

## Blade inside Vue templates

Vue owns `{{ }}` at build time, so Blade is emitted through two helpers that
are available in every template:

- `{{ blade('$lead->name') }}` compiles to `{{ $lead->name }}`. Works inside
  Maizzle components and in attributes: `<Button :href="blade('$url')">`.
- `bladeConfig('wasiy.marketing.url')` compiles to `{{ config('wasiy.marketing.url') }}`.
  Use it in attributes, where nesting quotes inside `blade()` breaks the HTML.
  The logo and footer link through it, so each environment points at its own
  marketing host (`WASIY_MARKETING_URL`).
- `assetUrl('images/mail/logo.png')` resolves to `/images/mail/logo.png` in the
  preview and to `{{ asset('images/mail/logo.png') }}` in the build. Put the
  file in `public/` here for the preview and in `apps/api/public/` for real.

Directives go in `<Raw>` so Vue leaves them alone:

```vue
<Raw>@foreach ($facts as $fact)</Raw>
<Row>…</Row>
<Raw>@endforeach</Raw>
```

Vue escapes `>` and quotes inside interpolations; the `afterTransform` hook in
the config decodes them back, but only within `{{ }}`, `{!! !!}` and known
directives, so regular text is untouched.
