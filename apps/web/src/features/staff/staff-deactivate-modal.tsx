import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../components/ui/confirm-modal'
import { notifySuccess } from '../../lib/notify'
import { deactivateStaff, type StaffSummary } from './api'

/**
 * Confirmation for the destructive half of suspension (mockup 06d card);
 * reactivation is reversible-by-definition and needs no modal.
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
      notifySuccess(t('staff.deactivated'))
    },
  })

  return (
    <ConfirmModal
      body={t('staff.deactivateHint')}
      confirmLabel={t('staff.deactivate')}
      loading={mutation.isPending}
      opened={staff !== null}
      title={t('staff.deactivateConfirmTitle', { name: staff?.name ?? '' })}
      onClose={onClose}
      onConfirm={() => staff && mutation.mutate(staff.id)}
    />
  )
}
