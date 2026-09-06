import { Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/** Shared illustration and neutral copy for empty tables, with optional page actions. */
export function TableEmptyState({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 py-8 text-center" role="status">
      <img alt="" aria-hidden="true" className="mb-3 h-28 w-28" height={112} src="/illustrations/empty-box.svg" width={112} />
      <Text fw={600}>{t('table.emptyTitle')}</Text>
      <Text c="dimmed" maw={320} size="sm">{t('table.emptyBody')}</Text>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}
