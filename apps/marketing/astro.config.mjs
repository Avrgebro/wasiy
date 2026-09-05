// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://wasiy.co',
  integrations: [
    sitemap({
      // The 404 route is not a canonical, indexable URL.
      filter: (page) => !page.includes('/404'),
    }),
  ],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Sora',
      cssVariable: '--font-sora',
      // Display face: only 600 and 700 are used across the components.
      weights: [600, 700],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
    },
    {
      provider: fontProviders.google(),
      name: 'Instrument Sans',
      cssVariable: '--font-instrument',
      // Body face: 400 (copy), 500 (footer links), 600 (labels and buttons).
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
    },
  ],
});
