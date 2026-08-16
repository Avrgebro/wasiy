import {
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RowStatusBadge } from './import-badges'
import { residentLabel, unitLabel } from './import-labels'
import {
  getRegistryImportRows,
  type RegistryImportRow,
  type RegistryImportRowStatus,
} from './api'

type RowFilter = RegistryImportRowStatus | ''

/**
 * Preview rows for one import. Mount with key={importId} so filter and
 * pagination state resets when the selected import changes.
 */
export function ImportRowsSection({ importId }: { importId: string | null }) {
  const { t } = useTranslation('common')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RowFilter>('')

  const rowsQuery = useQuery({
    enabled: Boolean(importId),
    queryKey: ['registry', 'imports', 'rows', importId, status, search, page],
    queryFn: () =>
      getRegistryImportRows(importId ?? '', {
        page,
        per_page: 15,
        search,
        status: status || undefined,
      }),
  })
  const rows = rowsQuery.data?.data ?? []

  const rowFilterOptions = useMemo(
    () => [
      { label: t('registry.imports.rowFilters.all'), value: '' },
      { label: t('registry.imports.rowFilters.valid'), value: 'valid' },
      { label: t('registry.imports.rowFilters.error'), value: 'error' },
      { label: t('registry.imports.rowFilters.duplicate'), value: 'duplicate' },
      { label: t('registry.imports.rowFilters.warning'), value: 'warning' },
    ],
    [t],
  )

  return (
    <section className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <Stack gap="md" p="md">
        <Group justify="space-between">
          <Text fw={700}>{t('registry.imports.preview')}</Text>
          {rowsQuery.isFetching ? <Loader size="sm" /> : null}
        </Group>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <TextInput
            defaultValue={search}
            label={t('actions.search')}
            onBlur={(event) => {
              setSearch(event.currentTarget.value)
              setPage(1)
            }}
          />
          <SegmentedControl
            data={rowFilterOptions}
            value={status}
            onChange={(value) => {
              setStatus(value as RowFilter)
              setPage(1)
            }}
          />
        </div>
      </Stack>
      <RowsTable rows={rows} />
      <div className="p-3">
        <Pagination
          onChange={setPage}
          total={rowsQuery.data?.meta?.last_page ?? 1}
          value={page}
        />
      </div>
    </section>
  )
}

function RowsTable({ rows }: { rows: RegistryImportRow[] }) {
  const { t } = useTranslation('common')

  if (rows.length === 0) {
    return <Text c="dimmed" p="md">{t('registry.imports.emptyRows')}</Text>
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('registry.imports.rowNumber')}</Table.Th>
          <Table.Th>{t('registry.status')}</Table.Th>
          <Table.Th>{t('registry.units.unit')}</Table.Th>
          <Table.Th>{t('registry.residents.name')}</Table.Th>
          <Table.Th>{t('registry.imports.messages')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => {
          const messages = [...row.errors, ...row.warnings]

          return (
            <Table.Tr key={row.id}>
              <Table.Td>{row.row_number}</Table.Td>
              <Table.Td><RowStatusBadge status={row.status} /></Table.Td>
              <Table.Td>{unitLabel(row.normalized_data)}</Table.Td>
              <Table.Td>{residentLabel(row.normalized_data)}</Table.Td>
              <Table.Td>{messages.length > 0 ? messages.join(' ') : '-'}</Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Tbody>
    </Table>
  )
}
