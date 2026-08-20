import { ActionIcon, Menu, Text } from '@mantine/core'
import { MenuDots } from '@solar-icons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { accountRoles } from '../auth/access'
import type { StaffSummary } from './api'
import {
  StaffAccountRoleBadge,
  StaffLocationChips,
  StaffName,
  StaffStatusBadge,
} from './staff-row-parts'

export function useStaffColumns({
  meUserId,
  onEdit,
}: {
  meUserId: string
  onEdit: (staff: StaffSummary) => void
}): ColumnDef<StaffSummary>[] {
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
        row.original.account_roles.includes(accountRoles.accountAdmin) ? (
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
    {
      id: 'actions',
      header: () => null,
      meta: { className: 'w-12' },
      cell: ({ row }) => (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon aria-label={t('staff.actions')} color="gray" variant="subtle">
              <MenuDots size={16} style={{ transform: 'rotate(90deg)' }} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => onEdit(row.original)}>{t('staff.editAccess')}</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ]
}
