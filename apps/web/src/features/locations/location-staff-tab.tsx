import { Alert, Avatar, Skeleton, Table, Text } from '@mantine/core'
import { Lock, UsersGroupRounded } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { getRoleLabelKey } from '../auth/access'
import { getStaff, type StaffSummary } from '../staff/api'

function initials(staff: StaffSummary) {
  return `${staff.first_name.charAt(0)}${staff.last_name.charAt(0)}`.toUpperCase()
}

/**
 * Read-only view of who works at this location (mockup 05). Assignment is
 * owned by /admin/staff: two places to assign roles would be two places to
 * keep the account-role vs location-role mutual-exclusion correct.
 */
export function LocationStaffTab({ accountId, locationId }: { accountId: string; locationId: string }) {
  const { t } = useTranslation('common')

  const staffQuery = useQuery({
    queryKey: ['staff', 'list', accountId, { location_id: locationId, scope: 'location-tab' }],
    queryFn: () => getStaff(accountId, { location_id: locationId, per_page: 100 }),
  })

  if (staffQuery.isLoading) {
    return <Skeleton height={180} radius="lg" />
  }

  if (staffQuery.isError) {
    return (
      <Alert color="error" title={t('errors.loadFailed')}>
        {getErrorMessage(staffQuery.error)}
      </Alert>
    )
  }

  const staff = staffQuery.data?.data ?? []
  // The staff page owns assignment; arriving pre-filtered to this location.
  const staffSearch = {
    page: 1,
    per_page: 15,
    search: '',
    role: '',
    location_id: locationId,
    status: '',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-4 py-3">
        <Lock className="shrink-0 text-[var(--wa-interactive)]" size={15} />
        <Text c="dimmed" size="sm">
          <strong className="text-[var(--mantine-color-text)]">{t('locations.staffTab.readOnly')}</strong>{' '}
          {t('locations.staffTab.readOnlyBody')}{' '}
          <Link
            className="font-semibold text-[var(--wa-interactive)] no-underline"
            search={staffSearch}
            to="/admin/staff"
          >
            {t('nav.staff')}
          </Link>
          .
        </Text>
      </div>

      {staff.length === 0 ? (
        <div className="grid min-h-56 place-items-center rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <UsersGroupRounded className="text-[var(--mantine-color-dimmed)]" size={26} />
            <Text fw={700}>{t('locations.staffTab.emptyTitle')}</Text>
            <Text c="dimmed" size="sm">
              {t('locations.staffTab.emptyBody')}
            </Text>
            <Link
              className="mt-1 font-semibold text-[var(--wa-interactive)] no-underline"
              search={staffSearch}
              to="/admin/staff"
            >
              {t('locations.staffTab.goToStaff')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('locations.staffTab.person')}</Table.Th>
                <Table.Th>{t('staff.role')}</Table.Th>
                <Table.Th>{t('locations.staffTab.access')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {staff.map((member) => {
                const assignment = member.location_assignments.find(
                  (item) => item.location_id === locationId,
                )

                return (
                  <Table.Tr key={member.id}>
                    <Table.Td>
                      <div className="flex items-center gap-3">
                        <Avatar color="secondary" radius="xl" size={34}>
                          {initials(member)}
                        </Avatar>
                        <div className="min-w-0">
                          <Text fw={600} size="sm" truncate>
                            {member.name}
                          </Text>
                          <Text c="dimmed" size="xs" truncate>
                            {member.email}
                          </Text>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      {assignment ? t(getRoleLabelKey(assignment.role)) : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {assignment?.role === 'front_desk'
                          ? t('locations.staffTab.frontDeskAccess')
                          : t('locations.staffTab.thisLocation')}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
