import { ActionIcon, Alert, Button, Group, Select, Skeleton, Text } from '@mantine/core'
import { AddCircle, AltArrowLeft, AltArrowRight } from '@solar-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { canManageRegistry } from '../auth/access'
import { useMe } from '../auth/hooks'
import { getAmenities } from '../locations/amenities-api'
import { getReservations, type ReservationSummary } from './api'
import { ApprovalQueue } from './approval-queue'
import { ReservationDetailModal } from './reservation-detail-modal'
import { ReservationFormDrawer } from './reservation-form-drawer'
import { ReservationWeekList } from './reservation-week-list'
import type { ReservationsSearchValues } from './schemas'
import { addDays, localDateString, startOfWeek, weekRangeLabel } from './week'

const routeApi = getRouteApi('/_authenticated/admin/reservations')

type StatusChip = NonNullable<ReservationsSearchValues['status']> | 'all'

function matchesChip(reservation: ReservationSummary, chip: StatusChip): boolean {
  switch (chip) {
    case 'pending':
      return reservation.status === 'pending' || reservation.status === 'observed'
    case 'approved':
      return reservation.status === 'approved' && !reservation.is_completed
    case 'completed':
      return reservation.is_completed
    default:
      return true
  }
}

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
      canDecide={canManageRegistry(me)}
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
  const [selected, setSelected] = useState<ReservationSummary | null>(null)

  const today = localDateString(new Date(), timezone)
  const anchor = search.date ?? today
  const weekStart = startOfWeek(anchor)
  const weekEnd = addDays(weekStart, 6)
  const chip: StatusChip = search.status ?? 'all'

  const weekQuery = useQuery({
    queryKey: ['reservations', 'week', accountId, locationId, weekStart],
    queryFn: () => getReservations(accountId, locationId, { from: weekStart, to: weekEnd }),
    placeholderData: keepPreviousData,
  })
  // One future-facing query feeds the queue (pending/observed become cards)
  // and the advisory conflict pool (its approved rows).
  const queueQuery = useQuery({
    queryKey: ['reservations', 'queue', accountId, locationId, today],
    queryFn: () => getReservations(accountId, locationId, { from: today }),
  })
  const amenitiesQuery = useQuery({
    queryKey: ['amenities', accountId, locationId],
    queryFn: () => getAmenities(accountId, locationId),
  })

  const weekReservations = (weekQuery.data?.data ?? []).filter(
    (reservation) =>
      matchesChip(reservation, chip) &&
      (!search.amenity_id || reservation.amenity_id === search.amenity_id),
  )
  const futureReservations = queueQuery.data?.data ?? []
  const requests = futureReservations.filter(
    (reservation) => reservation.status === 'pending' || reservation.status === 'observed',
  )
  const approvedPool = futureReservations.filter((reservation) => reservation.status === 'approved')
  const pendingCount = requests.length

  const amenityOptions = (amenitiesQuery.data?.data ?? []).map((amenity) => ({
    value: amenity.id,
    label: amenity.name,
  }))

  function updateSearch(next: Partial<ReservationsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next }) })
  }

  const chips: { key: StatusChip; label: string }[] = [
    { key: 'all', label: t('reservations.chips.all') },
    {
      key: 'pending',
      label:
        pendingCount > 0
          ? `${t('reservations.chips.pending')} · ${pendingCount}`
          : t('reservations.chips.pending'),
    },
    { key: 'approved', label: t('reservations.chips.approved') },
    { key: 'completed', label: t('reservations.chips.completed') },
  ]

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
        <Button
          className="w-full sm:w-auto"
          color="accent"
          leftSection={<AddCircle size={18} />}
          size="sm"
          onClick={() => setDrawerOpened(true)}
        >
          {t('reservations.newReservation')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((entry) => (
          <button
            key={entry.key}
            className={`cursor-pointer rounded-full border px-[15px] py-[7px] text-xs font-semibold transition-colors ${
              chip === entry.key
                ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]'
                : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'
            }`}
            type="button"
            onClick={() =>
              updateSearch({ status: entry.key === 'all' ? undefined : entry.key })
            }
          >
            {entry.label}
          </button>
        ))}
        <Select
          clearable
          aria-label={t('reservations.allAmenities')}
          className="w-full sm:ml-auto sm:w-64"
          data={amenityOptions}
          placeholder={t('reservations.allAmenities')}
          value={search.amenity_id ?? null}
          onChange={(value) => updateSearch({ amenity_id: value ?? undefined })}
        />
      </div>

      {weekQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(weekQuery.error)}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* The pager belongs to the agenda, not the page header: the queue
              on the right is week-agnostic. */}
          <div className="flex items-center justify-between gap-2">
            <Text className="min-w-0" fw={600} size="sm">
              {t('reservations.weekOf', { range: weekRangeLabel(weekStart) })}
            </Text>
            <Group className="shrink-0" gap={6} wrap="nowrap">
              <ActionIcon
                aria-label={t('reservations.previousWeek')}
                radius="md"
                size="input-sm"
                variant="default"
                onClick={() => updateSearch({ date: addDays(weekStart, -7) })}
              >
                <AltArrowLeft size={16} />
              </ActionIcon>
              <Button
                variant="default"
                size="sm"
                onClick={() => updateSearch({ date: undefined })}
              >
                {t('reservations.today')}
              </Button>
              <ActionIcon
                aria-label={t('reservations.nextWeek')}
                radius="md"
                size="input-sm"
                variant="default"
                onClick={() => updateSearch({ date: addDays(weekStart, 7) })}
              >
                <AltArrowRight size={16} />
              </ActionIcon>
            </Group>
          </div>
          {weekQuery.isLoading ? (
            <Skeleton height={320} radius="lg" />
          ) : (
            <div className={weekQuery.isPlaceholderData ? 'opacity-60' : undefined}>
              <ReservationWeekList
                reservations={weekReservations}
                timezone={timezone}
                today={today}
                onSelect={setSelected}
              />
            </div>
          )}
        </div>
        {queueQuery.isLoading ? (
          <Skeleton height={220} radius="lg" />
        ) : (
          <ApprovalQueue
            accountId={accountId}
            approvedPool={approvedPool}
            canDecide={canDecide}
            requests={requests}
            timezone={timezone}
          />
        )}
      </div>

      <ReservationDetailModal
        accountId={accountId}
        canDecide={canDecide}
        reservation={selected}
        timezone={timezone}
        onClose={() => setSelected(null)}
      />
      <ReservationFormDrawer
        accountId={accountId}
        amenities={amenitiesQuery.data?.data ?? []}
        locationId={locationId}
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
      />
    </div>
  )
}
