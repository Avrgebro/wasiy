import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { deactivateStaff, type StaffSummary } from './api'

/**
 * Confirmation for the destructive half of suspension; reactivation is
 * reversible-by-definition and needs no modal.
 */
export function StaffDeactivateModal({
  accountId,
  onClose,
  staff,
}: {
  accountId: string
  onClose: () => void
  staff: StaffSummary | null
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (userId: string) => deactivateStaff(accountId, userId),
    onSuccess: async () => {
      onClose()
      await queryClient.invalidateQueries({ queryKey: ['staff'] })
      showNotification({ color: 'green', message: t('staff.deactivated') })
    },
    onError: (error) => {
      showNotification({ color: 'red', message: getErrorMessage(error) })
    },
  })

  return (
    <Modal
      opened={staff !== null}
      title={t('staff.deactivateConfirmTitle', { name: staff?.name ?? '' })}
      onClose={onClose}
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          {t('staff.deactivateHint')}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            color="error"
            loading={mutation.isPending}
            onClick={() => staff && mutation.mutate(staff.id)}
          >
            {t('staff.deactivate')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
