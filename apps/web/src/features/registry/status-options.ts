export function statusOptions(t: (key: string) => string) {
  return [
    { label: t('registry.statuses.active'), value: 'active' },
    { label: t('registry.statuses.inactive'), value: 'inactive' },
  ]
}
