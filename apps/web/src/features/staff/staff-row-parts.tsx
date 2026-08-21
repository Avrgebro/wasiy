import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { accountRoles, getRoleLabelKey } from '../auth/access'
import type { StaffSummary } from './api'
import { AccessChip, TintChip } from './staff-badges'
import { staffStatus, type StaffStatus } from './staff-status'

const MAX_VISIBLE_ASSIGNMENTS = 2

const statusColors: Record<StaffStatus, string> = {
  active: 'success',
  deactivated: 'gray',
  unassigned: 'warning',
}

export function StaffStatusBadge({ staff }: { staff: StaffSummary }) {
  const { t } = useTranslation('common')
  const status = staffStatus(staff)

  return <TintChip color={statusColors[status]}>{t(`staff.statuses.${status}`)}</TintChip>
}

export function StaffAccountRoleBadge({ staff }: { staff: StaffSummary }) {
  const { t } = useTranslation('common')

  if (staff.account_role !== accountRoles.accountAdmin) {
    return null
  }

  return <TintChip color="teal">{t(getRoleLabelKey(accountRoles.accountAdmin))}</TintChip>
}

export function StaffLocationChips({ staff }: { staff: StaffSummary }) {
  const { t } = useTranslation('common')

  if (staff.location_assignments.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        —
      </Text>
    )
  }

  const visible = staff.location_assignments.slice(0, MAX_VISIBLE_ASSIGNMENTS)
  const hidden = staff.location_assignments.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((assignment) => (
        <AccessChip key={`${assignment.location_id}-${assignment.role}`}>
          {assignment.location_name ?? assignment.location_id} ·{' '}
          {t(getRoleLabelKey(assignment.role))}
        </AccessChip>
      ))}
      {hidden > 0 ? (
        <Text c="dimmed" fw={600} size="xs">
          {t('staff.moreLocations', { n: hidden })}
        </Text>
      ) : null}
    </div>
  )
}

export function StaffName({ meUserId, staff }: { meUserId: string; staff: StaffSummary }) {
  const { t } = useTranslation('common')

  return (
    <>
      <Text fw={600} size="sm">
        {staff.name}
        {staff.id === meUserId ? (
          <Text c="dimmed" component="span" size="xs">
            {' '}
            {t('staff.you')}
          </Text>
        ) : null}
      </Text>
      <Text c="dimmed" size="xs">
        {staff.email}
      </Text>
    </>
  )
}
