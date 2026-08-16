import { Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { RegistryImportRowStatus, RegistryImportSummary } from './api'

const statusColor: Record<RegistryImportSummary['status'], string> = {
  failed: 'red',
  completed: 'green',
  ready_for_review: 'blue',
  pending: 'gray',
  processing: 'gray',
}

const rowStatusColor: Record<RegistryImportRowStatus, string> = {
  error: 'red',
  warning: 'yellow',
  duplicate: 'gray',
  skipped: 'gray',
  valid: 'green',
  imported: 'green',
}

export function StatusBadge({ status }: { status: RegistryImportSummary['status'] }) {
  const { t } = useTranslation('common')

  return <Badge color={statusColor[status]}>{t(`registry.imports.statuses.${status}`)}</Badge>
}

export function RowStatusBadge({ status }: { status: RegistryImportRowStatus }) {
  const { t } = useTranslation('common')

  return <Badge color={rowStatusColor[status]}>{t(`registry.imports.rowStatuses.${status}`)}</Badge>
}
