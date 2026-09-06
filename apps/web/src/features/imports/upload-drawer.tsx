import { Alert, Badge, Button, Drawer, Stack, Text } from '@mantine/core'
import { UploadIcon } from '@solar-icons/react/linear'
import { Dropzone } from '@mantine/dropzone'
import { notifySuccess } from '../../lib/notify'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { createRegistryImport, type RegistryImportType } from './api'

export function UploadDrawer({
  importType,
  locationId,
  onClose,
  onUploaded,
  opened,
}: {
  importType: RegistryImportType
  locationId: string
  onClose: () => void
  onUploaded: (importId: string) => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => createRegistryImport(locationId, file, importType),
    onSuccess: async (response) => {
      setSelectedFile(null)
      onUploaded(response.data.id)
      await queryClient.invalidateQueries({ queryKey: ['registry', 'imports'] })
      notifySuccess(t('registry.imports.uploaded'), t('registry.savedTitle'))
    },
  })

  return (
    <Drawer
      opened={opened}
      position="right"
      title={t('registry.imports.uploadTitle')}
      transitionProps={{ duration: 0 }}
      withinPortal={false}
      onClose={onClose}
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
            <UploadIcon size={28} />
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
          <Alert color="error" title={t('errors.actionFailed')}>
            {getErrorMessage(uploadMutation.error)}
          </Alert>
        ) : null}
        <Button
          disabled={!selectedFile}
          leftSection={<UploadIcon size={16} />}
          loading={uploadMutation.isPending}
          onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
        >
          {t('registry.imports.uploadSubmit')}
        </Button>
      </Stack>
    </Drawer>
  )
}
