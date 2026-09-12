import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../components/ui/confirm-modal'
import { notifySuccess } from '../../lib/notify'
import { deactivateLocation, type LocationSummary } from './api'

/**
 * Names what deactivation touches before asking for it (mockup 06d). The
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
      notifySuccess(t('locations.deactivated'))
    },
  })

  return (
    <ConfirmModal
      body={t('locations.deactivateHint')}
      confirmLabel={t('locations.deactivateConfirm')}
      facts={
        location
          ? [
              { label: t('locations.affected.units'), value: location.units_count },
              { label: t('locations.affected.residents'), value: location.residents_count },
              { label: t('locations.affected.staff'), value: location.staff_count },
            ]
          : undefined
      }
      footnote={t('locations.deactivateReversible')}
      loading={mutation.isPending}
      opened={location !== null}
      title={t('locations.deactivateConfirmTitle', { name: location?.name ?? '' })}
      onClose={onClose}
      onConfirm={() => location && mutation.mutate(location.id)}
    />
  )
}
