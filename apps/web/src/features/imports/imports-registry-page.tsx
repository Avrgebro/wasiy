import { Alert, Button, Group, SimpleGrid } from '@mantine/core'
import { Upload } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import { getErrorMessage } from '../../lib/errors'
import { ImportDetailPanel } from './import-detail-panel'
import { ImportHistorySection } from './import-history-section'
import { ImportRowsSection } from './import-rows-section'
import { UploadDrawer } from './upload-drawer'
import { getRegistryImport, getRegistryImports } from './api'

const importType = 'registry_units_residents' as const

export function ImportsRegistryPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const account = meQuery.data?.active_account
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null

  if (!account || !location) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <ImportsRegistryContent account={account} location={location} />
}

function ImportsRegistryContent({
  account,
  location,
}: {
  account: { id: string }
  location: { id: string; name: string }
}) {
  const { t } = useTranslation('common')
  const [uploadOpened, setUploadOpened] = useState(false)
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null)
  const [importsPage, setImportsPage] = useState(1)

  const importsQuery = useQuery({
    queryKey: ['registry', 'imports', account.id, location.id, importsPage],
    queryFn: () =>
      getRegistryImports({
        account_id: account.id,
        import_type: importType,
        location_id: location.id,
        page: importsPage,
        per_page: 15,
      }),
  })
  const imports = importsQuery.data?.data ?? []
  const effectiveImportId = selectedImportId ?? imports[0]?.id ?? null

  const importDetailQuery = useQuery({
    enabled: Boolean(effectiveImportId),
    queryKey: ['registry', 'imports', 'detail', effectiveImportId],
    queryFn: () => getRegistryImport(effectiveImportId ?? ''),
  })
  const selectedImport = importDetailQuery.data?.data
    ?? imports.find((item) => item.id === effectiveImportId)
    ?? null

  return (
    <div className="flex flex-col gap-5">
      <Group justify="space-between">
        <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
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
        <ImportHistorySection
          currentLocationName={location.name}
          imports={imports}
          isFetching={importsQuery.isFetching}
          lastPage={importsQuery.data?.meta?.last_page ?? 1}
          onPageChange={setImportsPage}
          onSelect={setSelectedImportId}
          page={importsPage}
          selectedImportId={effectiveImportId}
        />
        <ImportDetailPanel selectedImport={selectedImport} />
      </SimpleGrid>

      <ImportRowsSection importId={effectiveImportId} key={effectiveImportId} />

      <UploadDrawer
        importType={importType}
        locationId={location.id}
        opened={uploadOpened}
        onClose={() => setUploadOpened(false)}
        onUploaded={(importId) => {
          setSelectedImportId(importId)
          setUploadOpened(false)
        }}
      />
    </div>
  )
}
