import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { formatMoney } from '../../lib/money'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { transitionMovement, type MovementStatus, type MovementSummary } from './api'
import { shortDate } from './month'
import { amountClassName, statusColor, statusLabel, transitionLabel } from './movement-presentation'

/**
 * Home for what the row does not show: audit trail, note, linked
 * reservation, and every allowed transition — including the cautious ones
 * (void, retain, revert) the inline action deliberately leaves out.
 */
export function MovementDetailModal({
  accountId,
  movement,
  onClose,
}: {
  accountId: string
  movement: MovementSummary | null
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (status: MovementStatus) => transitionMovement(accountId, movement!.id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finances'] })
      notifySuccess(t('finances.updated'))
      onClose()
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  return (
    <Modal centered opened={movement !== null} radius="lg" title={movement?.concept} onClose={onClose}>
      {movement ? (
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <span className={`font-mono text-2xl font-semibold ${amountClassName(movement)}`}>
              {formatMoney(movement.amount, { negative: movement.direction === 'expense' })}
            </span>
            <Badge color={statusColor(movement.status)} radius="xl" size="md" variant="light">
              {statusLabel(movement, t)}
            </Badge>
          </Group>

          <Stack gap={4}>
            {movement.detail ? <Text size="sm">{movement.detail}</Text> : null}
            <Row label={t('finances.columns.date')} value={shortDate(movement.occurred_on)} />
            {movement.due_on ? <Row label={t('finances.detail.dueOn')} value={shortDate(movement.due_on)} /> : null}
            <Row
              label={t('finances.columns.unit')}
              value={movement.unit_number ?? movement.counterparty ?? '—'}
            />
            <Row label={t('finances.detail.category')} value={t(`finances.categories.${movement.category}`)} />
            <Row label={t('finances.detail.recordedBy')} value={movement.created_by_name ?? '—'} />
            {movement.settled_by_name ? (
              <Row label={t('finances.detail.settledBy')} value={movement.settled_by_name} />
            ) : null}
            {movement.note ? <Row label={t('finances.detail.note')} value={movement.note} /> : null}
          </Stack>

          {movement.allowed_transitions.length > 0 ? (
            <Group gap="xs" justify="flex-end">
              {movement.allowed_transitions.map((status) => (
                <Button
                  key={status}
                  color={status === 'voided' || status === 'retained' ? 'error' : undefined}
                  loading={mutation.isPending}
                  size="xs"
                  variant={status === 'voided' || status === 'retained' ? 'subtle' : 'light'}
                  onClick={() => mutation.mutate(status)}
                >
                  {transitionLabel(status, t)}
                </Button>
              ))}
            </Group>
          ) : null}
        </Stack>
      ) : null}
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="sm" justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text className="text-right" size="sm">
        {value}
      </Text>
    </Group>
  )
}
