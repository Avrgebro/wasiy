/** Mockup metrics: 46px fields, 10px radius, 12.5px/600 muted labels. */
export const authFieldStyles = {
  label: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--mantine-color-dimmed)',
    marginBottom: 7,
    width: '100%',
  },
  input: { height: 46, borderRadius: 10, fontSize: 14.5 },
  innerInput: { height: 44, fontSize: 14.5 },
} as const

