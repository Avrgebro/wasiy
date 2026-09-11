import { PageAction } from '../../components/ui/page-action'
import { keepContextData } from '../../lib/keep-context-data'
import { ActionIcon, Alert, Button, Group, Skeleton, Text } from '@mantine/core'
import { AddIcon, AltArrowLeftIcon, AltArrowRightIcon } from '@solar-icons/react/linear'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { can } from '../auth/access'
import { useMe } from '../auth/hooks'
import { getAmenities } from '../locations/amenities-api'
import { getReservations, type ReservationSummary } from './api'
import { ApprovalQueue } from './approval-queue'
import { ReservationDrawer } from './reservation-drawer'
import { ReservationFormDrawer } from './reservation-form-drawer'
import { ReservationDayBoard } from './reservation-day-board'
import type { ReservationsSearchValues } from './schemas'
import { addDays, dayHeading, localDateString } from './week'

const routeApi = getRouteApi('/_authenticated/admin/reservations')

export function ReservationsPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const me = meQuery.data
  const account = me?.active_account
  const location = me?.active_location

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  if (!location) {
    return (
      <Alert color="warning" title={t('reservations.title')}>
        {t('reservations.noLocation')}
      </Alert>
    )
  }

  return (
    <ReservationsContent
      accountId={account.id}
      canDecide={can(me, 'reservations.decide')}
      locationId={location.id}
      locationName={location.name}
      timezone={location.timezone}
    />
  )
}

function ReservationsContent({
  accountId,
  canDecide,
  locationId,
  locationName,
  timezone,
}: {
  accountId: string
  canDecide: boolean
  locationId: string
  locationName: string
  timezone: string
}) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [drawerOpened, setDrawerOpened] = useState(false)
  // A row or queue card selects locally; the URL param (deep link from
  // Finanzas) seeds it. Closing clears both.
  const [localSelected, setLocalSelected] = useState<string | null>(null)
  const selectedId = localSelected ?? search.reservation ?? null
  const select = (reservation: ReservationSummary) => setLocalSelected(reservation.id)
  const closeDrawer = () => {
    setLocalSelected(null)
    if (search.reservation) {
      void navigate({ search: (current) => ({ ...current, reservation: undefined }) })
    }
  }

  const today = localDateString(new Date(), timezone)
  const date = search.date ?? today

  const dayQuery = useQuery({
    queryKey: ['reservations', 'day', accountId, locationId, date],
    queryFn: () => getReservations(accountId, locationId, { from: date, to: date }),
    placeholderData: keepContextData(['reservations', 'day', accountId, locationId]),
  })
  // Future pending/observed requests feed the approval queue.
  const queueQuery = useQuery({
    queryKey: ['reservations', 'queue', accountId, locationId, today],
    queryFn: () => getReservations(accountId, locationId, { from: today }),
  })
  const amenitiesQuery = useQuery({
    queryKey: ['amenities', accountId, locationId],
    queryFn: () => getAmenities(accountId, locationId),
  })

  const futureReservations = queueQuery.data?.data ?? []
  const requests = futureReservations.filter(
    (reservation) => reservation.status === 'pending' || reservation.status === 'observed',
  )

  function updateSearch(next: Partial<ReservationsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next }) })
  }

  return (
    <div className="@container flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">
            {t('reservations.title')}
          </h1>
          <Text c="dimmed" mt={6} size="sm">
            {t('reservations.subtitle', { location: locationName })}
          </Text>
        </div>
        <PageAction
          className="w-full sm:w-auto"
          color="accent"
          leftSection={<AddIcon size={18} />}
          onClick={() => setDrawerOpened(true)}
        >
          {t('reservations.newReservation')}
        </PageAction>
      </div>



      {dayQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(dayQuery.error)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* The pager belongs to the board, not the page header: the queue
              on the right is day-agnostic. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text className="min-w-0 capitalize" fw={600} size="sm">
              {dayHeading(date)}
            </Text>
            <Group className="shrink-0" gap={6} wrap="nowrap">
              <ActionIcon
                aria-label={t('reservations.previousDay')}
                radius="md"
                size={44}
                variant="default"
                onClick={() => updateSearch({ date: addDays(date, -1) })}
              >
                <AltArrowLeftIcon size={16} />
              </ActionIcon>
              <Button h={44} disabled={date === today} variant="default" onClick={() => updateSearch({ date: undefined })}>
                {t('reservations.today')}
              </Button>
              <ActionIcon
                aria-label={t('reservations.nextDay')}
                radius="md"
                size={44}
                variant="default"
                onClick={() => updateSearch({ date: addDays(date, 1) })}
              >
                <AltArrowRightIcon size={16} />
              </ActionIcon>
            </Group>
          </div>
          <ReservationDayBoard
            amenities={amenitiesQuery.data?.data ?? []}
            date={date}
            loading={dayQuery.isLoading || amenitiesQuery.isLoading}
            reservations={dayQuery.data?.data ?? []}
            timezone={timezone}
            today={today}
            onSelect={select}
          />
        </div>
        {queueQuery.isLoading ? (
          <Skeleton height={220} radius="lg" />
        ) : (
          <ApprovalQueue
            accountId={accountId}
            canDecide={canDecide}
            requests={requests}
            timezone={timezone}
            onSelect={select}
          />
        )}
      </div>

      <ReservationDrawer
        accountId={accountId}
        canDecide={canDecide}
        reservationId={selectedId}
        timezone={timezone}
        onClose={closeDrawer}
      />
      <ReservationFormDrawer
        accountId={accountId}
        amenities={amenitiesQuery.data?.data ?? []}
        locationId={locationId}
        opened={drawerOpened}
        timezone={timezone}
        onClose={() => setDrawerOpened(false)}
      />
    </div>
  )
}
