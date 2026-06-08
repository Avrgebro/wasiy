import { Button, Table } from '@mantine/core'
import { Download, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatCard } from '../../components/ui/stat-card'

const rows = [
  { unit: 'A-1203', resident: 'María Torres', status: 'Activo' },
  { unit: 'B-0704', resident: 'Carlos Méndez', status: 'Pendiente' },
  { unit: 'C-0302', resident: 'Lucía Rivas', status: 'Activo' },
]

export function DashboardPage() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold leading-8 text-[var(--foreground)]">
            {t('dashboard.heading')}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('dashboard.summary')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button leftSection={<Search size={16} />} variant="default">
            {t('actions.search')}
          </Button>
          <Button leftSection={<Download size={16} />} variant="default">
            {t('actions.export')}
          </Button>
          <Button leftSection={<Plus size={16} />}>{t('actions.newVisitor')}</Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          detail={t('dashboard.stats.occupiedUnitsDetail')}
          label={t('dashboard.stats.occupiedUnits')}
          value="128"
        />
        <StatCard
          detail={t('dashboard.stats.expectedVisitorsDetail')}
          label={t('dashboard.stats.expectedVisitors')}
          value="14"
        />
        <StatCard
          detail={t('dashboard.stats.pendingReservationsDetail')}
          label={t('dashboard.stats.pendingReservations')}
          value="6"
        />
      </section>

      <section className="rounded-md border border-[var(--border)] bg-white">
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
            {rows.map((row) => (
              <Table.Tr key={row.unit}>
                <Table.Td>{row.unit}</Table.Td>
                <Table.Td>{row.resident}</Table.Td>
                <Table.Td>{row.status}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </section>
    </div>
  )
}
