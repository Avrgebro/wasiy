import { Alert, Button, Loader, Table } from '@mantine/core'
import { AddCircle, Download, Magnifier } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { StatCard } from '../../components/ui/stat-card'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import { getLocationDashboard } from './api'

export function DashboardPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const hasAccessibleLocations =
    (meQuery.data?.accessible_locations.length ?? 0) > 0
  const dashboardQuery = useQuery({
    queryKey: ['locations', location?.id, 'dashboard'],
    queryFn: () => {
      if (!location) {
        throw new Error(t('auth.noAssignedLocation'))
      }

      return getLocationDashboard(location.id)
    },
    enabled: Boolean(location),
  })

  if (meQuery.isLoading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader aria-label={t('common.loading')} />
      </div>
    )
  }

  if (!location) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {hasAccessibleLocations
          ? t('auth.selectLocationRequired')
          : t('auth.noAssignedLocation')}
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold leading-8 text-[var(--foreground)]">
            {t('dashboard.heading', { location: location.name })}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('dashboard.summary')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button leftSection={<Magnifier size={16} />} variant="default">
            {t('actions.search')}
          </Button>
          <Button leftSection={<Download size={16} />} variant="default">
            {t('actions.export')}
          </Button>
          <Button leftSection={<AddCircle size={16} />}>
            {t('actions.newVisitor')}
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          detail={t('dashboard.stats.assignedStaffDetail')}
          label={t('dashboard.stats.assignedStaff')}
          value={
            dashboardQuery.isLoading
              ? t('common.loadingShort')
              : String(
                  dashboardQuery.data?.metrics.assigned_staff_count ?? 0,
                )
          }
        />
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--foreground)]">
            {t('dashboard.registryTitle')}
          </h2>
        </div>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('dashboard.table.unit')}</Table.Th>
              <Table.Th>{t('dashboard.table.resident')}</Table.Th>
              <Table.Th>{t('dashboard.table.status')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td colSpan={3}>{t('dashboard.emptyRegistry')}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </section>
    </div>
  )
}
