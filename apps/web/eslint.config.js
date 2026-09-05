import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

import surfaces from './surfaces.json' with { type: 'json' }

/** Staff-only feature folders; everything else under src/features is shared or portal. Kept in surfaces.json so src/features/boundary.test.ts can check the list stays complete. */
const STAFF_FEATURES = surfaces.staffFeatures

export default defineConfig([
  globalIgnores(['dist', 'src/routeTree.admin.gen.ts', 'src/routeTree.portal.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/routes-admin/**/*.{ts,tsx}', 'src/routes-portal/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Toasts go through lib/notify so variant styling lives in one place.
    // Exceptions: notify itself, main.tsx (mounts the provider), and tests
    // (they mount the provider to assert on toasts).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/notify.tsx', 'src/main.tsx', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mantine/notifications',
              message:
                'Use notifySuccess/notifyError/notifyWarning/notifyInfo from lib/notify instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Surface boundary: the portal may lean on shared rooms (components, lib,
    // app, i18n), on features/auth, the navigation spec and the invitation
    // pages, and on itself. Staff features are listed explicitly: gitignore
    // semantics cannot re-include a path under an excluded directory, so
    // negations do not work here. src/features/boundary.test.ts keeps the
    // list complete.
    files: ['src/features/portal/**/*.{ts,tsx}', 'src/routes-portal/**/*.{ts,tsx}', 'src/components/layout/portal/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...STAFF_FEATURES.flatMap((feature) => [`**/features/${feature}/**`, `../${feature}/**`, `../${feature}`]),
                '**/features/navigation/admin-navigation*',
                '../navigation/admin-navigation*',
              ],
              message: 'Portal code may not import staff features. Lift what you need into components/, lib/ or features/auth first.',
            },
            { group: ['**/routes-admin/**', '**/components/layout/shared/app-shell', '**/components/layout/shared/sidebar*', '**/components/layout/shared/topbar*'], message: 'Portal code may not import the staff shell.' },
          ],
        },
      ],
    },
  },
  {
    // …and staff code never reaches into the portal.
    files: ['src/features/**/*.{ts,tsx}', 'src/routes-admin/**/*.{ts,tsx}', 'src/components/layout/shared/**/*.{ts,tsx}'],
    ignores: ['src/features/portal/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/features/portal/**', '**/routes-portal/**', '**/components/layout/portal/**'], message: 'Staff code may not import the resident portal.' },
          ],
        },
      ],
    },
  },
])
