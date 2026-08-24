import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { deactivateLocation, type LocationSummary } from './api'

function AffectedCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--mantine-color-default-border)] py-1.5 last:border-b-0">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </div>
  )
}

/**
 * Names what deactivation touches before asking for it (06d). The
 * last-active-location guard lives on the server; its validation message
 * surfaces here as the error notification.
 */
export function LocationDeactivateModal({
  accountId,
  location,
  onClose,
}: {
  accountId: string
  location: LocationSummary | null
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (locationId: string) => deactivateLocation(accountId, locationId),
    onSuccess: async () => {
      onClose()
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      // Deactivation also drops the location from accessible_locations.
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      showNotification({ color: 'green', message: t('locations.deactivated') })
    },
    onError: (error) => {
      showNotification({ color: 'red', message: getErrorMessage(error) })
    },
  })

  return (
    <Modal
      opened={location !== null}
      title={t('locations.deactivateConfirmTitle', { name: location?.name ?? '' })}
      onClose={onClose}
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          {t('locations.deactivateHint')}
        </Text>
        {location ? (
          <div>
            <AffectedCount label={t('locations.affected.units')} value={location.units_count} />
            <AffectedCount
              label={t('locations.affected.residents')}
              value={location.residents_count}
            />
            <AffectedCount label={t('locations.affected.staff')} value={location.staff_count} />
          </div>
        ) : null}
        <Text c="dimmed" size="sm">
          {t('locations.deactivateReversible')}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            color="error"
            loading={mutation.isPending}
            onClick={() => location && mutation.mutate(location.id)}
          >
            {t('locations.deactivate')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
