import { createTheme, rem, type CSSVariablesResolver } from '@mantine/core'

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': 'var(--background)',
    '--mantine-color-text': 'var(--foreground)',
    '--mantine-color-default': 'var(--card)',
    '--mantine-color-default-hover': 'var(--muted)',
    '--mantine-color-default-color': 'var(--foreground)',
    '--mantine-color-default-border': 'var(--border)',
    '--mantine-color-dimmed': 'var(--muted-foreground)',
    '--mantine-color-placeholder': 'var(--muted-foreground)',
  },
  dark: {
    '--mantine-color-body': 'var(--background)',
    '--mantine-color-text': 'var(--foreground)',
    '--mantine-color-default': 'var(--card)',
    '--mantine-color-default-hover': 'var(--muted)',
    '--mantine-color-default-color': 'var(--foreground)',
    '--mantine-color-default-border': 'var(--border)',
    '--mantine-color-dimmed': 'var(--muted-foreground)',
    '--mantine-color-placeholder': 'var(--muted-foreground)',
  },
})

export const theme = createTheme({
  primaryColor: 'wasiy',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, Segoe UI, Roboto, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, Segoe UI, Roboto, sans-serif',
    sizes: {
      h1: { fontSize: rem(24), lineHeight: '32px', fontWeight: '700' },
      h2: { fontSize: rem(18), lineHeight: '28px', fontWeight: '700' },
    },
  },
  colors: {
    gray: [
      '#f8fafc',
      '#f1f5f9',
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#64748b',
      '#475569',
      '#334155',
      '#1e293b',
      '#0f172a',
    ],
    dark: [
      '#f4f2ff',
      '#d8d3ef',
      '#b7b1d6',
      '#85809f',
      '#565b73',
      '#303a50',
      '#263247',
      '#1c2536',
      '#151c2a',
      '#0f1420',
    ],
    wasiy: [
      '#f3f0ff',
      '#e4dfff',
      '#c9bfff',
      '#ab99ff',
      '#9177f5',
      '#7d63e5',
      '#6e56cf',
      '#5f48b8',
      '#503c9a',
      '#40317b',
    ],
  },
})
