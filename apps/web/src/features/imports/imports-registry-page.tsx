import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { showNotification } from '@mantine/notifications'
import { CheckCircle, Refresh, Upload } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import {
  confirmRegistryImport,
  createRegistryImport,
  getRegistryImport,
  getRegistryImportRows,
  getRegistryImports,
  retryRegistryImport,
  type RegistryImportRow,
  type RegistryImportRowStatus,
  type RegistryImportSummary,
} from './api'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'

type RowFilter = RegistryImportRowStatus | ''

const importType = 'registry_units_residents' as const

export function ImportsRegistryPage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const meQuery = useMe()
  const account = meQuery.data?.active_account
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const [uploadOpened, setUploadOpened] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)
  const [importsPage, setImportsPage] = useState(1)
  const [rowsPage, setRowsPage] = useState(1)
  const [rowSearch, setRowSearch] = useState('')
  const [rowStatus, setRowStatus] = useState<RowFilter>('')

  const importsQuery = useQuery({
    enabled: Boolean(account),
    queryKey: ['registry', 'imports', account?.id, location?.id, importsPage],
    queryFn: () =>
      getRegistryImports({
        account_id: account?.id ?? '',
        import_type: importType,
        location_id: location?.id,
        page: importsPage,
        per_page: 15,
      }),
  })
  const imports = useMemo(
    () => (Array.isArray(importsQuery.data?.data) ? importsQuery.data.data : []),
    [importsQuery.data],
  )
  const effectiveImportId = selectedImportId ?? imports[0]?.id ?? null

  const importDetailQuery = useQuery({
    enabled: Boolean(effectiveImportId),
    queryKey: ['registry', 'imports', 'detail', effectiveImportId],
    queryFn: () => getRegistryImport(effectiveImportId ?? ''),
  })
  const selectedImport = importDetailQuery.data?.data
    ?? imports.find((item) => item.id === effectiveImportId)
    ?? null

  const rowsQuery = useQuery({
    enabled: Boolean(effectiveImportId),
    queryKey: [
      'registry',
      'imports',
      'rows',
      effectiveImportId,
      rowStatus,
      rowSearch,
      rowsPage,
    ],
    queryFn: () =>
      getRegistryImportRows(effectiveImportId ?? '', {
        page: rowsPage,
        per_page: 15,
        search: rowSearch,
        status: rowStatus || undefined,
      }),
  })
  const rows = Array.isArray(rowsQuery.data?.data) ? rowsQuery.data.data : []

  const uploadMutation = useMutation({
    mutationFn: () =>
      createRegistryImport(location?.id ?? '', selectedFile as File, importType),
    onSuccess: async (response) => {
      setSelectedImportId(response.data.id)
      setUploadOpened(false)
      setSelectedFile(null)
      await queryClient.invalidateQueries({ queryKey: ['registry', 'imports'] })
      showNotification({
        color: 'green',
        message: t('registry.imports.uploaded'),
        title: t('registry.savedTitle'),
      })
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmRegistryImport(selectedImport?.id ?? ''),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registry', 'imports'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'residents'] }),
      ])
      showNotification({
        color: 'green',
        message: t('registry.imports.confirmed'),
        title: t('registry.savedTitle'),
      })
    },
  })

  const retryMutation = useMutation({
    mutationFn: () => retryRegistryImport(selectedImport?.id ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'imports'] })
      showNotification({
        color: 'green',
        message: t('registry.imports.retryQueued'),
        title: t('registry.savedTitle'),
      })
    },
  })

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

  if (!account || !location) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  const canConfirm =
    selectedImport?.status === 'ready_for_review' && selectedImport.error_rows === 0
  const canRetry = selectedImport?.status === 'failed' && !selectedImport.confirmed_at

  return (
    <div className="flex flex-col gap-5">
      <Group justify="space-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('registry.imports.title')}
        </h1>
        <Button leftSection={<Upload size={16} />} onClick={() => setUploadOpened(true)}>
          {t('registry.imports.uploadAction')}
        </Button>
      </Group>

      {importsQuery.isError ? (
        <Alert color="red" title={t('errors.loadFailed')}>
          {getErrorMessage(importsQuery.error)}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <Group justify="space-between" p="md">
            <Text fw={700}>{t('registry.imports.history')}</Text>
            {importsQuery.isFetching ? <Loader size="sm" /> : null}
          </Group>
          <ImportsTable
            imports={imports}
            currentLocationName={location?.name}
            selectedImportId={effectiveImportId}
            onSelect={(importId) => {
              setSelectedImportId(importId)
              setRowsPage(1)
            }}
          />
          <div className="p-3">
            <Pagination
              onChange={setImportsPage}
              total={importsQuery.data?.meta?.last_page ?? 1}
              value={importsPage}
            />
          </div>
        </section>

        <section className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
          {selectedImport ? (
            <Stack gap="md">
              <Group align="start" justify="space-between">
                <div>
                  <Text fw={700}>{selectedImport.original_filename}</Text>
                  <Text c="dimmed" size="sm">
                    {selectedImport.created_at
                      ? formatDate(selectedImport.created_at)
                      : '-'}
                  </Text>
                </div>
                <StatusBadge status={selectedImport.status} />
              </Group>

              <ImportCounters registryImport={selectedImport} />

              {selectedImport.failure_reason ? (
                <Alert color="red" title={t('registry.imports.failureReason')}>
                  {selectedImport.failure_reason}
                </Alert>
              ) : null}

              <Group>
                <Button
                  disabled={!canConfirm}
                  leftSection={<CheckCircle size={16} />}
                  loading={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                >
                  {t('registry.imports.confirm')}
                </Button>
                {canRetry ? (
                  <Button
                    leftSection={<Refresh size={16} />}
                    loading={retryMutation.isPending}
                    variant="light"
                    onClick={() => retryMutation.mutate()}
                  >
                    {t('registry.imports.retry')}
                  </Button>
                ) : null}
              </Group>

              {confirmMutation.isError ? (
                <Alert color="red" title={t('errors.actionFailed')}>
                  {getErrorMessage(confirmMutation.error)}
                </Alert>
              ) : null}
              {retryMutation.isError ? (
                <Alert color="red" title={t('errors.actionFailed')}>
                  {getErrorMessage(retryMutation.error)}
                </Alert>
              ) : null}
            </Stack>
          ) : (
            <Text c="dimmed">{t('registry.imports.empty')}</Text>
          )}
        </section>
      </SimpleGrid>

      <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
        <Stack gap="md" p="md">
          <Group justify="space-between">
            <Text fw={700}>{t('registry.imports.preview')}</Text>
            {rowsQuery.isFetching ? <Loader size="sm" /> : null}
          </Group>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <TextInput
              defaultValue={rowSearch}
              label={t('actions.search')}
              onBlur={(event) => {
                setRowSearch(event.currentTarget.value)
                setRowsPage(1)
              }}
            />
            <SegmentedControl
              data={rowFilterOptions}
              value={rowStatus}
              onChange={(value) => {
                setRowStatus(value as RowFilter)
                setRowsPage(1)
              }}
            />
          </div>
        </Stack>
        <RowsTable rows={rows} />
        <div className="p-3">
          <Pagination
            onChange={setRowsPage}
            total={rowsQuery.data?.meta?.last_page ?? 1}
            value={rowsPage}
          />
        </div>
      </section>

      <Drawer
        opened={uploadOpened}
        position="right"
        title={t('registry.imports.uploadTitle')}
        transitionProps={{ duration: 0 }}
        withinPortal={false}
        onClose={() => setUploadOpened(false)}
      >
        <Stack gap="md">
          <Dropzone
            accept={['text/csv', 'text/plain']}
            inputProps={{ 'aria-label': t('registry.imports.fileLabel') }}
            maxFiles={1}
            multiple={false}
            onDrop={(files) => setSelectedFile(files[0] ?? null)}
          >
            <Stack align="center" gap="xs">
              <Upload size={28} />
              <Text fw={600}>{t('registry.imports.dropzoneTitle')}</Text>
              <Text c="dimmed" size="sm">
                {t('registry.imports.dropzoneHint')}
              </Text>
            </Stack>
          </Dropzone>
          {selectedFile ? (
            <Badge variant="light">{selectedFile.name}</Badge>
          ) : null}
          {uploadMutation.isError ? (
            <Alert color="red" title={t('errors.actionFailed')}>
              {getErrorMessage(uploadMutation.error)}
            </Alert>
          ) : null}
          <Button
            disabled={!selectedFile}
            leftSection={<Upload size={16} />}
            loading={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {t('registry.imports.uploadSubmit')}
          </Button>
        </Stack>
      </Drawer>
    </div>
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

function ImportCounters({ registryImport }: { registryImport: RegistryImportSummary }) {
  const { t } = useTranslation('common')
  const counters = [
    ['total', registryImport.total_rows],
    ['valid', registryImport.valid_rows],
    ['error', registryImport.error_rows],
    ['duplicate', registryImport.duplicate_rows],
    ['warning', registryImport.warning_rows],
  ] as const

  return (
    <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="xs">
      {counters.map(([key, value]) => (
        <div
          className="rounded-md border border-[var(--border)] p-3"
          key={key}
        >
          <Text c="dimmed" size="xs">
            {t(`registry.imports.counterLabels.${key}`)}
          </Text>
          <Text fw={700}>{value}</Text>
        </div>
      ))}
    </SimpleGrid>
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
        {rows.map((row) => (
          <Table.Tr key={row.id}>
            <Table.Td>{row.row_number}</Table.Td>
            <Table.Td><RowStatusBadge status={row.status} /></Table.Td>
            <Table.Td>{unitLabel(row.normalized_data)}</Table.Td>
            <Table.Td>{residentLabel(row.normalized_data)}</Table.Td>
            <Table.Td>
              {[...row.errors, ...row.warnings].length > 0
                ? [...row.errors, ...row.warnings].join(' ')
                : '-'}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

function StatusBadge({ status }: { status: RegistryImportSummary['status'] }) {
  const { t } = useTranslation('common')
  const color = status === 'failed'
    ? 'red'
    : status === 'completed'
      ? 'green'
      : status === 'ready_for_review'
        ? 'blue'
        : 'gray'

  return <Badge color={color}>{t(`registry.imports.statuses.${status}`)}</Badge>
}

function RowStatusBadge({ status }: { status: RegistryImportRowStatus }) {
  const { t } = useTranslation('common')
  const color = status === 'error'
    ? 'red'
    : status === 'warning'
      ? 'yellow'
      : status === 'duplicate' || status === 'skipped'
        ? 'gray'
        : 'green'

  return <Badge color={color}>{t(`registry.imports.rowStatuses.${status}`)}</Badge>
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function locationLabel(
  registryImport: RegistryImportSummary,
  currentLocationName?: string,
) {
  return registryImport.location?.name
    ?? registryImport.location_name
    ?? currentLocationName
    ?? registryImport.location_id
}

function unitLabel(normalizedData: Record<string, unknown>) {
  return (
    [
      stringValue(normalizedData.building_name),
      stringValue(normalizedData.unit_number),
    ]
      .filter(Boolean)
      .join(' / ') || '-'
  )
}

function residentLabel(normalizedData: Record<string, unknown>) {
  return (
    [
      stringValue(normalizedData.first_name),
      stringValue(normalizedData.last_name),
    ]
      .filter(Boolean)
      .join(' ') || '-'
  )
}
