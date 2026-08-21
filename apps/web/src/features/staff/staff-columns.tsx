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
import { staffStatus } from './staff-status'

export function useStaffColumns({
  meUserId,
  onDeactivate,
  onEdit,
  onReactivate,
}: {
  meUserId: string
  onDeactivate: (staff: StaffSummary) => void
  onEdit: (staff: StaffSummary) => void
  onReactivate: (staff: StaffSummary) => void
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
    {
      id: 'actions',
      header: () => null,
      meta: { className: 'w-12' },
      cell: ({ row }) => {
        const staff = row.original
        const deactivated = staffStatus(staff) === 'deactivated'

        return (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon aria-label={t('staff.actions')} color="gray" variant="subtle">
                <MenuDots size={16} style={{ transform: 'rotate(90deg)' }} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {deactivated ? (
                <Menu.Item onClick={() => onReactivate(staff)}>
                  {t('staff.reactivate')}
                </Menu.Item>
              ) : (
                <>
                  <Menu.Item onClick={() => onEdit(staff)}>{t('staff.editAccess')}</Menu.Item>
                  {staff.id === meUserId ? null : (
                    <Menu.Item color="error" onClick={() => onDeactivate(staff)}>
                      {t('staff.deactivate')}
                    </Menu.Item>
                  )}
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        )
      },
    },
  ]
}
