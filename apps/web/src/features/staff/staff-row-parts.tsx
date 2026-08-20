import { Badge, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { accountRoles, getRoleLabelKey } from '../auth/access'
import type { StaffSummary } from './api'
import { AccessChip } from './staff-badges'
import { staffStatus, type StaffStatus } from './staff-status'

const MAX_VISIBLE_ASSIGNMENTS = 2

const statusColors: Record<StaffStatus, string> = {
  active: 'green',
  deactivated: 'gray',
  unassigned: 'yellow',
}

export function StaffStatusBadge({ staff }: { staff: StaffSummary }) {
  const { t } = useTranslation('common')
  const status = staffStatus(staff)

  return (
    <Badge color={statusColors[status]} radius="xl" size="md" tt="none" variant="light">
      {t(`staff.statuses.${status}`)}
    </Badge>
  )
}

export function StaffAccountRoleBadge({ staff }: { staff: StaffSummary }) {
  const { t } = useTranslation('common')

  if (!staff.account_roles.includes(accountRoles.accountAdmin)) {
    return null
  }

  return (
    <Badge radius="xl" size="md" tt="none" variant="light">
      {t(getRoleLabelKey(accountRoles.accountAdmin))}
    </Badge>
  )
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
