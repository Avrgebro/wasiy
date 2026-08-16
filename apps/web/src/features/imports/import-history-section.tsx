import { Button, Group, Loader, Pagination, Table, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/dates'
import { StatusBadge } from './import-badges'
import { locationLabel } from './import-labels'
import type { RegistryImportSummary } from './api'

export function ImportHistorySection({
  currentLocationName,
  imports,
  isFetching,
  lastPage,
  onPageChange,
  onSelect,
  page,
  selectedImportId,
}: {
  currentLocationName?: string
  imports: RegistryImportSummary[]
  isFetching: boolean
  lastPage: number
  onPageChange: (page: number) => void
  onSelect: (importId: string) => void
  page: number
  selectedImportId: string | null
}) {
  const { t } = useTranslation('common')

  return (
    <section className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <Group justify="space-between" p="md">
        <Text fw={700}>{t('registry.imports.history')}</Text>
        {isFetching ? <Loader size="sm" /> : null}
      </Group>
      <ImportsTable
        imports={imports}
        currentLocationName={currentLocationName}
        selectedImportId={selectedImportId}
        onSelect={onSelect}
      />
      <div className="p-3">
        <Pagination onChange={onPageChange} total={lastPage} value={page} />
      </div>
    </section>
  )
}

function ImportsTable({
  currentLocationName,
  imports,
  onSelect,
  selectedImportId,
}: {
  currentLocationName?: string
  imports: RegistryImportSummary[]
  onSelect: (importId: string) => void
  selectedImportId: string | null
}) {
  const { t } = useTranslation('common')

  if (imports.length === 0) {
    return <Text c="dimmed" p="md">{t('registry.imports.empty')}</Text>
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('registry.imports.filename')}</Table.Th>
          <Table.Th>{t('registry.imports.location')}</Table.Th>
          <Table.Th>{t('registry.status')}</Table.Th>
          <Table.Th>{t('registry.imports.counters')}</Table.Th>
          <Table.Th>{t('registry.imports.requestedAt')}</Table.Th>
          <Table.Th>{t('registry.imports.completedAt')}</Table.Th>
          <Table.Th>{t('registry.imports.failureReason')}</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {imports.map((registryImport) => (
          <Table.Tr key={registryImport.id}>
            <Table.Td>{registryImport.original_filename}</Table.Td>
            <Table.Td>{locationLabel(registryImport, currentLocationName)}</Table.Td>
            <Table.Td><StatusBadge status={registryImport.status} /></Table.Td>
            <Table.Td>
              {registryImport.valid_rows}/{registryImport.error_rows}/
              {registryImport.duplicate_rows}/{registryImport.warning_rows}
            </Table.Td>
            <Table.Td>{registryImport.created_at ? formatDate(registryImport.created_at) : '-'}</Table.Td>
            <Table.Td>{registryImport.completed_at ? formatDate(registryImport.completed_at) : '-'}</Table.Td>
            <Table.Td>{registryImport.failure_reason ?? '-'}</Table.Td>
            <Table.Td>
              <Button
                size="xs"
                variant={selectedImportId === registryImport.id ? 'filled' : 'subtle'}
                onClick={() => onSelect(registryImport.id)}
              >
                {t('registry.imports.review')}
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
