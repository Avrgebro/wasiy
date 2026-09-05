import { Button, Loader, Text } from '@mantine/core'
import { AddCircle } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { getPortalPackages, getPortalReservations, getPortalVisits } from './api'
import { PortalCard, PortalRow, StatusPill } from './portal-cards'
import { ageLabel, arrivedAt, expectedLabel, reservationRange, reservationTone, statusTone } from './presentation'

/** Inicio (Portal 01): today's board for the active unit. */
export function PortalHomePage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const navigate = useNavigate()
  const { active } = useActiveUnit()
  const now = new Date()
  const timezone = me?.active_location?.timezone ?? 'America/Lima'

  const visits = useQuery({ queryKey: ['portal', 'visits', active?.unit_id, 'today'], queryFn: () => getPortalVisits(active!.unit_id, 'today'), enabled: active !== null })
  const packages = useQuery({ queryKey: ['portal', 'packages', active?.unit_id, 'pending'], queryFn: () => getPortalPackages(active!.unit_id, 'pending'), enabled: active !== null })
  const reservations = useQuery({ queryKey: ['portal', 'reservations', active?.unit_id, 'upcoming'], queryFn: () => getPortalReservations(active!.unit_id, 'upcoming'), enabled: active !== null })

  if (!active) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.noUnit')}
      </Text>
    )
  }

  const dateLine = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(now)
  const todayVisits = visits.data?.data ?? []
  const pendingPackages = packages.data?.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="m-0 text-2xl font-bold">{t('portal.greeting', { name: me?.user.first_name ?? '' })}</h1>
        <Text c="dimmed" mt={4} size="sm">
          {dateLine}
        </Text>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button color="accent" component={Link} leftSection={<AddCircle size={18} />} size="md" to="/portal/visitas/nueva">
          {t('portal.visits.preRegister')}
        </Button>
        <Button size="md" variant="default" onClick={() => void navigate({ to: '/portal/reservas', search: { chip: 'amenidades' } })}>
          {t('portal.reservations.book')}
        </Button>
      </div>

      {visits.isLoading || packages.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : null}

      {reservations.data?.data[0] ? (
        <PortalCard title={t('portal.reservations.next')} to="/portal/reservas" viewAllLabel={t('portal.reservations.view')}>
          <PortalRow
            pill={<StatusPill color={reservationTone(reservations.data.data[0].status)}>{t(`portal.reservations.status.${reservations.data.data[0].status}`)}</StatusPill>}
            primary={reservations.data.data[0].amenity_name ?? ''}
            secondary={reservationRange(reservations.data.data[0].starts_at, reservations.data.data[0].ends_at, timezone)}
          />
        </PortalCard>
      ) : null}

      {visits.data ? (
        <PortalCard count={todayVisits.length} empty={t('portal.visits.noneToday')} title={t('portal.visits.expectedToday')} to="/portal/visitas" viewAllLabel={t('portal.viewAll')}>
          {todayVisits.slice(0, 3).map((visit) => (
            <PortalRow
              key={visit.id}
              pill={
                <StatusPill color={statusTone(visit.status)}>
                  {visit.status === 'expected' ? t('portal.visits.status.expected') : t('portal.visits.arrivedAt', { time: arrivedAt(visit, timezone) })}
                </StatusPill>
              }
              primary={visit.visitor_name}
              secondary={expectedLabel(visit, now, timezone, t) || null}
            />
          ))}
        </PortalCard>
      ) : null}

      {packages.data ? (
        <PortalCard count={pendingPackages.length} countColor="accent" empty={t('portal.packages.none')} title={t('portal.packages.atDesk')}>
          {pendingPackages.slice(0, 3).map((pkg) => (
            <PortalRow
              key={pkg.id}
              pill={<StatusPill color="warning">{t('portal.packages.toCollect')}</StatusPill>}
              primary={pkg.notes ?? t('portal.packages.package')}
              secondary={ageLabel(pkg.received_at, now, timezone, t)}
            />
          ))}
        </PortalCard>
      ) : null}
    </div>
  )
}
