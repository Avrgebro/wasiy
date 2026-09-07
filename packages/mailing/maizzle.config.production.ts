import { defineConfig } from '@maizzle/framework'
import baseConfig from './maizzle.config'

/**
 * Production config, used by `pnpm build:mail`. Extends the preview config
 * and writes Blade views into the Laravel API. The compiled files are
 * committed: Forge deploys the API without Node.
 */
export default defineConfig({
  ...baseConfig,

  // Maizzle empties this folder on every build, so it must contain nothing
  // hand-written. Authored Blade mail stays one level up in views/mail/.
  output: {
    path: '../../apps/api/resources/views/mail/maizzle',
    extension: 'blade.php',
  },

  // Never copy public/ next to the views. Emails need absolute image URLs,
  // which assetUrl() below resolves through Laravel; public/ only feeds the
  // local preview.
  static: {
    source: [],
  },

  vue: {
    ...baseConfig.vue,
    globalProperties: {
      ...baseConfig.vue?.globalProperties,
      assetUrl: (path: string) => `{{ asset('${path}') }}`,
    },
  },
})
