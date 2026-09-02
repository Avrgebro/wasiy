import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
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
    files: ['src/routes/**/*.{ts,tsx}'],
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
])
