import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../components/ui/confirm-modal'
import { notifySuccess } from '../../lib/notify'
import { deactivateLocation, type LocationSummary } from './api'

/**
 * Names what deactivation touches before asking for it (mockup 06d). The
 * last-active-location guard lives on the server; the dialog mirrors it so
 * the button is never a dead end.
 */
export function LocationDeactivateModal({
  account,
  accountId,
  location,
  onClose,
}: {
  /** Name and location counts from /me, for the blocked variant. */
  account: { name: string; locations_count: number; active_locations_count: number }
  accountId: string
  location: LocationSummary | null
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  // The server refuses to retire the last active location; the dialog says
  // so up front instead of letting the request fail (mockup 06d, "Bloqueada").
  const blocked = location?.status === 'active' && account.active_locations_count <= 1

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

  if (blocked) {
    return (
      <ConfirmModal
        body={t('locations.deactivateBlockedBody', { name: location?.name ?? '', account: account.name })}
        cancelLabel={t('actions.close')}
        confirmDisabled
        confirmLabel={t('locations.deactivateConfirm')}
        facts={[
          { label: t('locations.affected.activeLocations'), value: account.active_locations_count },
          { label: t('locations.affected.inactiveLocations'), value: account.locations_count - account.active_locations_count },
        ]}
        footnote={t('locations.deactivateBlockedHint')}
        opened={location !== null}
        title={t('locations.deactivateBlockedTitle')}
        tone="error"
        onClose={onClose}
        onConfirm={() => undefined}
      />
    )
  }

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
