import { defineConfig } from '@maizzle/framework'

/**
 * Base config, used by the local preview (`pnpm dev:mail`). The production
 * overrides that write Blade into the Laravel API live in
 * `maizzle.config.production.ts` and are applied by `pnpm build:mail`.
 *
 * Vue's SSR escapes interpolated text, so `{{ blade('$lead->name') }}` would
 * compile to `{{ $lead-&gt;name }}`, which is invalid PHP once Blade runs it.
 * The afterTransform hook decodes entities back, but only inside Blade
 * constructs so ordinary HTML text is never altered.
 */
function decodeBladeEntities(fragment: string): string {
  return fragment
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * Brand tokens live in tailwind.css as a Tailwind `@theme` block. Maizzle's
 * Layout compiles exactly one `<style>` (its own `@import "@maizzle/tailwindcss"`),
 * and adding a second Tailwind unit anywhere breaks utility ordering (the
 * Container lost its `mx-auto`). So the tokens are appended into that same
 * import from afterRender, which runs before the CSS transformers. Quotes are
 * entity-encoded at that point, hence the tolerant regex.
 */
const TOKENS = new URL('./tailwind.css', import.meta.url).pathname
const TW_IMPORT = /@import\s+(["']|&quot;|&#34;)@maizzle\/tailwindcss\1\s*;?/

const BLADE_DIRECTIVES =
  /@(?:if|elseif|unless|foreach|forelse|for|while|isset|empty|switch|case|include|includeIf|includeWhen|each|selected|checked|disabled|class|style)\s*\([^\n]*\)/g

export default defineConfig({
  afterRender({ html }) {
    const m = html.match(TW_IMPORT)
    if (!m) return
    return html.replace(TW_IMPORT, `${m[0]}\n@import ${m[1]}${TOKENS}${m[1]};`)
  },

  afterTransform({ html }) {
    return html
      .replace(/\{\{[^]*?\}\}/g, decodeBladeEntities)
      .replace(/\{!![^]*?!!\}/g, decodeBladeEntities)
      .replace(BLADE_DIRECTIVES, decodeBladeEntities)
  },

  css: {
    inline: true,
    purge: true,
    shorthand: true,
  },

  vue: {
    globalProperties: {
      /**
       * Emit a literal Blade echo. Vue owns `{{ }}` at build time, so
       * `{{ blade('$lead->name') }}` compiles to `{{ $lead->name }}` for
       * Laravel to render. Directives (`@if`, `@foreach`) go in `<Raw>`.
       */
      blade: (expression: string) => `{{ ${expression} }}`,

      /**
       * Blade echo of a Laravel config value, for attributes where nesting
       * quotes gets awkward: `:href="bladeConfig('wasiy.marketing.url')"`
       * compiles to `{{ config('wasiy.marketing.url') }}`.
       */
      bladeConfig: (key: string) => `{{ config('${key}') }}`,

      /**
       * Environment-aware image URL. In the preview this points at the copy
       * under `public/`; the production config emits `{{ asset('...') }}` so
       * Laravel builds the absolute URL for each environment.
       */
      assetUrl: (path: string) => `/${path}`,
    },
  },
})
