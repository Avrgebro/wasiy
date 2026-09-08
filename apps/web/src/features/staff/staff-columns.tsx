import { Text } from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { openRowColumn } from '../../components/table/open-row-column'
import { accountRoles } from '../auth/access'
import type { StaffSummary } from './api'
import {
  StaffAccountRoleBadge,
  StaffLocationChips,
  StaffName,
  StaffStatusBadge,
} from './staff-row-parts'

/**
 * Rows carry no per-row menu: clicking one opens the access drawer, which
 * holds edit, deactivate and reactivate like every other list in the app.
 */
export function useStaffColumns({ meUserId }: { meUserId: string }): ColumnDef<StaffSummary>[] {
  const { t } = useTranslation('common')

  return [
    {
      id: 'name',
      header: t('staff.name'),
      cell: ({ row }) => <StaffName meUserId={meUserId} staff={row.original} />,
    },
    {
      id: 'account_role',
      header: t('staff.accountRole'),
      cell: ({ row }) =>
        row.original.account_role === accountRoles.accountAdmin ? (
          <StaffAccountRoleBadge staff={row.original} />
        ) : (
          <Text c="dimmed" size="sm">
            —
          </Text>
        ),
    },
    {
      id: 'locations',
      header: t('staff.locations'),
      cell: ({ row }) => <StaffLocationChips staff={row.original} />,
    },
    {
      id: 'status',
      header: t('registry.status'),
      cell: ({ row }) => <StaffStatusBadge staff={row.original} />,
    },
    openRowColumn(),
  ]
}
