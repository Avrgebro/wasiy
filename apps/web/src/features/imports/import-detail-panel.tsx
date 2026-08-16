import { Alert, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { CheckCircle, Refresh } from '@solar-icons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'
import { StatusBadge } from './import-badges'
import { confirmRegistryImport, retryRegistryImport, type RegistryImportSummary } from './api'

export function ImportDetailPanel({
  selectedImport,
}: {
  selectedImport: RegistryImportSummary | null
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  const confirmMutation = useMutation({
    mutationFn: (importId: string) => confirmRegistryImport(importId),
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
    mutationFn: (importId: string) => retryRegistryImport(importId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'imports'] })
      showNotification({
        color: 'green',
        message: t('registry.imports.retryQueued'),
        title: t('registry.savedTitle'),
      })
    },
  })

  const canConfirm =
    selectedImport?.status === 'ready_for_review' && selectedImport.error_rows === 0
  const canRetry = selectedImport?.status === 'failed' && !selectedImport.confirmed_at

  return (
    <section className="rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-4">
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
              onClick={() => confirmMutation.mutate(selectedImport.id)}
            >
              {t('registry.imports.confirm')}
            </Button>
            {canRetry ? (
              <Button
                leftSection={<Refresh size={16} />}
                loading={retryMutation.isPending}
                variant="light"
                onClick={() => retryMutation.mutate(selectedImport.id)}
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
          className="rounded-md border border-[var(--mantine-color-default-border)] p-3"
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
