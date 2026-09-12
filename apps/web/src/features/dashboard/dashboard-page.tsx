import { PageAction } from '../../components/ui/page-action'
import { TableEmptyState } from '../../components/table/table-empty-state'
import { Alert, Button, Loader, Table, Text } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StatCard } from '../../components/ui/stat-card'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { can, isAccountAdmin } from '../auth/access'
import { useMe } from '../auth/hooks'
import type { MeResponse } from '../auth/types'
import { RegisterPackageDrawer } from '../packages/register-package-drawer'
import { reservationStatusColor, reservationStatusKey } from '../reservations/reservation-presentation'
import { RegisterVisitDrawer } from '../visits/register-visit-drawer'
import { durationLabel } from '../visits/visit-presentation'
import { getLocationDashboard, type DashboardManagement, type DashboardToday } from './api'
import { bareAgeLabel, packageAgeLabel, relativeLabel, unitChipLabel } from './dashboard-presentation'
import { locationDashboardQueryKey } from './query-options'
import { StatusPill } from '../../components/ui/chips'

export function DashboardPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const me = meQuery.data
  const location = me?.active_location

  if (meQuery.isLoading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <Loader aria-label={t('common.loading')} />
      </div>
    )
  }

  if (!me || !me.active_account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  if (!location) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {me.accessible_locations.length > 0 ? t('auth.selectLocationRequired') : t('auth.noAssignedLocation')}
      </Alert>
    )
  }

  return <DashboardContent accountId={me.active_account.id} locationId={location.id} locationName={location.name} me={me} timezone={location.timezone} />
}

function DashboardContent({ accountId, locationId, locationName, me, timezone }: { accountId: string; locationId: string; locationName: string; me: MeResponse; timezone: string }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  // Ledger reads (the management strip) are gated; ledger actions live on Finanzas.
  const canManage = can(me, 'finances.manage')
  const [registeringVisit, setRegisteringVisit] = useState(false)
  const [registeringPackage, setRegisteringPackage] = useState(false)
  const now = new Date()

  const dashboardQuery = useQuery({
    queryKey: locationDashboardQueryKey(locationId),
    queryFn: () => getLocationDashboard(locationId),
  })

  // The drawers refresh their own lists; the panel's aggregates live under a
  // different key, so closing any of them refetches the board.
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: locationDashboardQueryKey(locationId) })
  }

  const dateLine = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(now)
  const data = dashboardQuery.data

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('dashboard.heading', { location: locationName })}</h1>
          <Text c="dimmed" mt={6} size="sm">
            {t('dashboard.today', { date: dateLine })}
          </Text>
        </div>
        <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
          {/* The screen's single amber CTA. */}
          <PageAction className="w-full sm:w-auto" color="accent" onClick={() => setRegisteringVisit(true)}>
            {t('visits.register')}
          </PageAction>
          <PageAction className="w-full sm:w-auto" variant="default" onClick={() => setRegisteringPackage(true)}>
            {t('packages.register')}
          </PageAction>
        </div>
      </div>

      {dashboardQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          <p>{getErrorMessage(dashboardQuery.error)}</p>
          <Button className="mt-3" variant="default" onClick={() => void dashboardQuery.refetch()}>
            {t('router.retry')}
          </Button>
        </Alert>
      ) : null}

      {dashboardQuery.isLoading ? (
        <div className="grid min-h-40 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : null}

      {data ? <TodayStrip canManage={canManage} now={now} timezone={timezone} today={data.today} /> : null}
      {data?.management ? <ManagementStrip management={data.management} now={now} showActivityLink={isAccountAdmin(me)} timezone={timezone} /> : null}

      <RegisterVisitDrawer
        accountId={accountId}
        locationId={locationId}
        locationName={locationName}
        opened={registeringVisit}
        onClose={() => {
          setRegisteringVisit(false)
          refresh()
        }}
      />
      <RegisterPackageDrawer
        accountId={accountId}
        locationId={locationId}
        locationName={locationName}
        opened={registeringPackage}
        onClose={() => {
          setRegisteringPackage(false)
          refresh()
        }}
      />
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--wa-text-3)]">{children}</h2>
}

/** The bordered card with a titled header, optional caption, and optional footer link. */
function PanelCard({ title, caption, footer, children }: { title: string; caption?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--mantine-color-default-border)] px-5 py-[15px]">
        <h3 className="m-0 font-display text-base font-semibold text-[var(--mantine-color-text)]">{title}</h3>
        {caption}
      </div>
      {children}
      {footer ? <div className="flex items-center border-t border-[var(--mantine-color-default-border)] px-5 py-[13px]">{footer}</div> : null}
    </section>
  )
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-[12.5px] font-semibold text-[var(--wa-interactive)] no-underline hover:underline" to={to}>
      {children}
    </Link>
  )
}

/** A filled row inside a card: the inner-card recipe (surface-2, inner radius). */
function InnerRow({ children }: { children: ReactNode }) {
  return <li className="flex items-center gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-[13px] py-[11px]">{children}</li>
}

function UnitChip({ label }: { label: string }) {
  return <span className="shrink-0 rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-2.5 py-[3px] font-mono text-[11.5px] font-medium">{label}</span>
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <Text c="dimmed" className="px-5 py-6 text-center" size="sm">
      {children}
    </Text>
  )
}

function TodayStrip({ canManage, now, timezone, today }: { canManage: boolean; now: Date; timezone: string; today: DashboardToday }) {
  const { t } = useTranslation('common')

  return (
    <section className="flex flex-col gap-3.5">
      <SectionLabel>{t('dashboard.sections.today')}</SectionLabel>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail={today.visitors_overdue_count > 0 ? t('dashboard.tiles.visitorsOverdue', { count: today.visitors_overdue_count }) : undefined}
          highlighted={today.visitors_overdue_count > 0}
          label={t('dashboard.tiles.visitorsInside')}
          value={String(today.visitors_inside_count)}
        />
        <StatCard
          detail={today.packages_oldest_received_at ? t('dashboard.tiles.packagesOldest', { age: bareAgeLabel(today.packages_oldest_received_at, now, timezone, t) }) : undefined}
          label={t('dashboard.tiles.packagesPending')}
          value={String(today.packages_pending_count)}
        />
        <StatCard
          detail={today.reservations_with_deposit_count > 0 ? t('dashboard.tiles.withDeposit', { count: today.reservations_with_deposit_count }) : undefined}
          label={t('dashboard.tiles.reservationsToday')}
          value={String(today.reservations_today_count)}
        />
        {canManage ? (
          <StatCard label={t('dashboard.tiles.pendingMovements')} value={String(today.pending_movements_count)} />
        ) : (
          <StatCard label={t('dashboard.tiles.exitsToday')} value={String(today.exits_today_count)} />
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PanelCard
          caption={
            <StatusPill color="success">
              {t('dashboard.cards.insideCount', { count: today.visitors_inside_count })}
            </StatusPill>
          }
          footer={<CardLink to="/admin/visitors">{t('dashboard.cards.viewAll')}</CardLink>}
          title={t('dashboard.cards.visitorsInside')}
        >
          {today.visitors_inside.length === 0 ? (
            <EmptyLine>{t('dashboard.empty.visitors')}</EmptyLine>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-4">
              {today.visitors_inside.map((visit) => (
                <InnerRow key={visit.id}>
                  <span aria-label={visit.is_overdue ? t('dashboard.overdue') : undefined} className={`size-1.5 shrink-0 rounded-full ${visit.is_overdue ? 'bg-[var(--wa-accent)]' : ''}`} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{visit.visitor_name}</span>
                  <UnitChip label={unitChipLabel(visit.unit_number, visit.building_name)} />
                  <span className="w-[86px] shrink-0 text-right font-mono text-[12.5px] text-[var(--mantine-color-dimmed)]">{durationLabel(visit, now, t)}</span>
                </InnerRow>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          caption={
            <StatusPill color="accent">
              {t('dashboard.cards.atDeskCount', { count: today.packages_pending_count })}
            </StatusPill>
          }
          footer={<CardLink to="/admin/packages">{t('dashboard.cards.viewAll')}</CardLink>}
          title={t('dashboard.cards.packagesPending')}
        >
          {today.packages_pending.length === 0 ? (
            <EmptyLine>{t('dashboard.empty.packages')}</EmptyLine>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-4">
              {today.packages_pending.map((pkg) => (
                <InnerRow key={pkg.id}>
                  <UnitChip label={unitChipLabel(pkg.unit_number, pkg.building_name)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{pkg.resident_name ?? t('dashboard.primaryContact')}</span>
                    {pkg.notes ? <span className="block truncate text-xs text-[var(--mantine-color-dimmed)]">{pkg.notes}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-[12.5px] text-[var(--mantine-color-dimmed)]">{packageAgeLabel(pkg.received_at, now, timezone, t)}</span>
                </InnerRow>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard caption={<CardLink to="/admin/reservations">{t('dashboard.cards.viewCalendar')}</CardLink>} title={t('dashboard.cards.reservationsToday')}>
        {today.reservations_today.length === 0 ? (
          <TableEmptyState />
        ) : (
          <div className="overflow-x-auto">
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('dashboard.columns.amenity')}</Table.Th>
                  <Table.Th>{t('dashboard.columns.unit')}</Table.Th>
                  <Table.Th className="hidden md:table-cell">{t('dashboard.columns.resident')}</Table.Th>
                  <Table.Th>{t('dashboard.columns.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {today.reservations_today.map((reservation) => {
                  const statusKey = reservationStatusKey(reservation)

                  return (
                    <Table.Tr key={reservation.id}>
                      <Table.Td>{reservation.amenity_name}</Table.Td>
                      <Table.Td className="font-mono text-[12.5px]">{reservation.unit_number}</Table.Td>
                      <Table.Td className="hidden md:table-cell">{reservation.resident_name ?? '—'}</Table.Td>
                      <Table.Td>
                        <StatusPill color={reservationStatusColor(statusKey)}>
                          {t(`reservations.statuses.${statusKey}`)}
                        </StatusPill>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </PanelCard>
    </section>
  )
}

function ManagementStrip({ management, now, showActivityLink, timezone }: { management: DashboardManagement; now: Date; showActivityLink: boolean; timezone: string }) {
  const { t } = useTranslation('common')
  const percent = management.dues_issued_total_minor > 0 ? Math.round((management.dues_collected_total_minor / management.dues_issued_total_minor) * 100) : null
  const segments = [
    { key: 'occupied', count: management.units_occupied, color: 'var(--wa-interactive)' },
    { key: 'vacant', count: management.units_vacant, color: 'var(--mantine-color-dimmed)' },
    { key: 'noPrimary', count: management.units_without_primary_contact, color: 'var(--wa-accent)' },
  ] as const
  const barTotal = segments.reduce((sum, segment) => sum + segment.count, 0)

  return (
    <section className="flex flex-col gap-3.5">
      <SectionLabel>{t('dashboard.sections.management')}</SectionLabel>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail={percent === null ? undefined : t('dashboard.tiles.duesIssued', { total: formatMoney(management.dues_issued_total_minor), percent })}
          label={t('dashboard.tiles.duesCollected')}
          value={formatMoney(management.dues_collected_total_minor)}
        />
        <StatCard detail={t('dashboard.tiles.ofUnits', { total: management.units_total })} label={t('dashboard.tiles.unitsWithBalance')} value={String(management.units_with_balance_count)} />
        <StatCard
          detail={management.deposits_held_count > 0 ? t('dashboard.tiles.depositsHeldCount', { count: management.deposits_held_count }) : undefined}
          label={t('dashboard.tiles.depositsHeld')}
          value={formatMoney(management.deposits_held_total_minor)}
        />
        <StatCard label={t('dashboard.tiles.residentsNotInvited')} value={String(management.residents_not_invited_count)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PanelCard
          caption={
            <Text c="dimmed" size="xs">
              {t('dashboard.cards.unitsTotal', { count: management.units_total })}
            </Text>
          }
          title={t('dashboard.cards.units')}
        >
          <div className="flex flex-col gap-3.5 px-5 pt-4 pb-[18px]">
            <div aria-hidden className="flex h-3.5 overflow-hidden rounded-full bg-[var(--wa-surface-2)]">
              {barTotal > 0
                ? segments.map((segment) => <span key={segment.key} style={{ flex: segment.count, backgroundColor: segment.color }} />)
                : null}
            </div>
            <div className="flex flex-wrap gap-x-[18px] gap-y-2">
              {segments.map((segment) => (
                <span key={segment.key} className="flex items-center gap-[7px] text-[12.5px] text-[var(--mantine-color-dimmed)]">
                  <span aria-hidden className="size-2 rounded-[2px]" style={{ backgroundColor: segment.color }} />
                  {t(`dashboard.units.${segment.key}`)}
                </span>
              ))}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {segments.map((segment) => (
                <li key={segment.key} className="flex items-center justify-between gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-[13px] py-2.5">
                  <span className="text-[13px] text-[var(--mantine-color-dimmed)]">{t(`dashboard.units.${segment.key}`)}</span>
                  <span className="font-display text-sm font-semibold">{segment.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </PanelCard>

        <PanelCard caption={showActivityLink ? <CardLink to="/admin/activity">{t('dashboard.cards.viewAllActivity')}</CardLink> : undefined} title={t('dashboard.cards.activity')}>
          {management.activity.length === 0 ? (
            <EmptyLine>{t('dashboard.empty.activity')}</EmptyLine>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-[11px] px-5 pt-4 pb-[18px]">
              {management.activity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="w-[78px] shrink-0 whitespace-nowrap font-mono text-xs text-[var(--wa-text-3)]">{entry.created_at ? relativeLabel(entry.created_at, now, timezone, t) : ''}</span>
                  <span className="text-[13px] leading-relaxed">
                    {entry.summary}
                    {entry.actor_name ? <span className="text-[var(--wa-text-3)]"> · {entry.actor_name}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </PanelCard>
      </div>
    </section>
  )
}
