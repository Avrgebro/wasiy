import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { getRoleLabelKey } from '../auth/access'
import {
  resendStaffInvitation,
  revokeStaffInvitation,
  type PendingStaffInvitation,
} from './api'
import { AccessChip } from './staff-badges'

const DAY_MS = 24 * 60 * 60 * 1000

function expiryLabel(t: (key: string, options?: Record<string, unknown>) => string, expiresAt: string) {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS)

  if (days < 0) {
    return { expired: true, label: t('staff.pending.expired') }
  }

  if (days === 0) {
    return { expired: false, label: t('staff.pending.expiresToday') }
  }

  if (days === 1) {
    return { expired: false, label: t('staff.pending.expiresInOneDay') }
  }

  return { expired: false, label: t('staff.pending.expiresInDays', { n: days }) }
}

/**
 * Invited-but-unaccepted people cannot appear in the staff table (they hold
 * no roles yet), so the API returns them as a separate unfiltered set and
 * this section renders them above the table.
 */
export function PendingInvitations({
  accountId,
  invitations,
  locationNames,
}: {
  accountId: string
  invitations: PendingStaffInvitation[]
  locationNames: Map<string, string>
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [revoking, setRevoking] = useState<PendingStaffInvitation | null>(null)

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => resendStaffInvitation(accountId, invitationId),
    onSuccess: async () => {
      // Resending issues a fresh token with a new expiry, so the card's
      // "Vence en N días" needs the latest data.
      await queryClient.invalidateQueries({ queryKey: ['staff', 'invitations'] })
      showNotification({ color: 'green', message: t('staff.pending.resent') })
    },
    onError: (error) => {
      showNotification({ color: 'red', message: getErrorMessage(error) })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeStaffInvitation(accountId, invitationId),
    onSuccess: async () => {
      setRevoking(null)
      await queryClient.invalidateQueries({ queryKey: ['staff'] })
      showNotification({ color: 'green', message: t('staff.pending.revoked') })
    },
    onError: (error) => {
      showNotification({ color: 'red', message: getErrorMessage(error) })
    },
  })

  if (invitations.length === 0) {
    return null
  }

  return (
    // @container makes the row breakpoints track the card's own width, not
    // the viewport — with the sidebar open a 1024px screen leaves ~690px of
    // card, where the columnar layout can't fit without overlapping.
    <section className="@container overflow-hidden rounded-lg border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <Group gap="xs" className="border-b border-[var(--mantine-color-default-border)] px-4 py-3.5 sm:px-5">
        <Text component="h2" fw={700} size="md">
          {t('staff.pending.title')}
        </Text>
        <span className="rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default-hover)] px-2.5 py-0.5 text-xs font-semibold text-[var(--mantine-color-dimmed)]">
          {invitations.length}
        </span>
      </Group>
      {invitations.map((invitation, index) => {
        const expiry = invitation.expires_at ? expiryLabel(t, invitation.expires_at) : null

        return (
          <div
            key={invitation.id}
            className={`flex flex-col gap-2.5 px-4 py-3.5 @4xl:flex-row @4xl:items-center @4xl:gap-4 @4xl:py-3 sm:px-5 ${
              index > 0 ? 'border-t border-[var(--mantine-color-default-border)]' : ''
            }`}
          >
            {/* Narrow: identity left, expiry right. Wide: identity is the first column. */}
            <div className="flex items-start justify-between gap-3 @4xl:block @4xl:w-56 @4xl:shrink-0">
              <div className="min-w-0">
                <Text fw={600} size="sm" truncate>
                  {invitation.first_name} {invitation.last_name}
                </Text>
                <Text c="dimmed" size="xs" truncate>
                  {invitation.email}
                </Text>
              </div>
              {expiry ? (
                <Text
                  c={expiry.expired ? 'red' : 'dimmed'}
                  className="shrink-0 whitespace-nowrap @4xl:hidden"
                  fw={600}
                  size="xs"
                >
                  {expiry.label}
                </Text>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 @4xl:flex-1">
              {invitation.invited_account_role ? (
                <AccessChip>{t(getRoleLabelKey(invitation.invited_account_role))}</AccessChip>
              ) : null}
              {invitation.invited_location_assignments.map((assignment) => (
                <AccessChip key={`${assignment.location_id}-${assignment.role}`}>
                  {locationNames.get(assignment.location_id) ?? assignment.location_id} ·{' '}
                  {t(getRoleLabelKey(assignment.role))}
                </AccessChip>
              ))}
            </div>
            {/* Narrow: one footer line, inviter left + actions right. Wide: the
                wrapper dissolves (contents) and its children become columns. */}
            <div className="flex items-center justify-between gap-3 @4xl:contents">
              <Text
                c="dimmed"
                className="min-w-0 truncate @4xl:w-44 @4xl:shrink-0"
                size="xs"
              >
                {invitation.invited_by.name
                  ? t('staff.pending.invitedBy', { name: invitation.invited_by.name })
                  : ''}
              </Text>
              <Text
                c={expiry?.expired ? 'red' : 'dimmed'}
                className="hidden @4xl:block @4xl:w-28 @4xl:shrink-0"
                fw={600}
                size="xs"
              >
                {expiry?.label ?? ''}
              </Text>
              <Group gap={6} wrap="nowrap" className="shrink-0">
                <Button
                  fw={600}
                  loading={resendMutation.isPending && resendMutation.variables === invitation.id}
                  radius="md"
                  size="compact-sm"
                  styles={{ root: { height: 34, paddingInline: 12 } }}
                  variant="subtle"
                  onClick={() => resendMutation.mutate(invitation.id)}
                >
                  {t('staff.pending.resend')}
                </Button>
                <Button
                  color="red"
                  fw={600}
                  radius="md"
                  size="compact-sm"
                  styles={{ root: { height: 34, paddingInline: 12 } }}
                  variant="subtle"
                  onClick={() => setRevoking(invitation)}
                >
                  {t('staff.pending.revoke')}
                </Button>
              </Group>
            </div>
          </div>
        )
      })}
      <Modal
        opened={revoking !== null}
        title={t('staff.pending.revokeTitle', { email: revoking?.email ?? '' })}
        onClose={() => setRevoking(null)}
      >
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            {t('staff.pending.revokeBody')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRevoking(null)}>
              {t('actions.cancel')}
            </Button>
            <Button
              color="red"
              loading={revokeMutation.isPending}
              onClick={() => revoking && revokeMutation.mutate(revoking.id)}
            >
              {t('staff.pending.revokeConfirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  )
}
