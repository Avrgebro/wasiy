import { createTheme, rem } from '@mantine/core'

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
