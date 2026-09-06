import { SearchInput } from '../../components/table/search-input'
import { TableToolbar } from '../../components/table/table-toolbar'
import { FilterButton } from '../../components/table/filter-button'
import { FILTER_COMBOBOX_PROPS } from '../../components/table/filter-combobox-props'
import { keepContextData } from '../../lib/keep-context-data'
import { ActionIcon, Alert, Button, Group, Select, Skeleton, Text } from '@mantine/core'
import { QuickFilters } from '../../components/table/quick-filters'
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
  const anchor = search.date ?? today
  const weekStart = startOfWeek(anchor)
  const weekEnd = addDays(weekStart, 6)
  const chip: StatusChip = search.status ?? 'all'

  const weekQuery = useQuery({
    queryKey: ['reservations', 'week', accountId, locationId, weekStart],
    queryFn: () => getReservations(accountId, locationId, { from: weekStart, to: weekEnd }),
    placeholderData: keepContextData(['reservations', 'week', accountId, locationId]),
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

  const searchText = normalizeSearch(search.search ?? '')
  const weekReservations = (weekQuery.data?.data ?? []).filter(
    (reservation) =>
      matchesChip(reservation, chip) &&
      (!searchText || [reservation.unit_number, reservation.resident_name].some((value) => normalizeSearch(value ?? '').includes(searchText))) &&
      (!search.amenity_id || reservation.amenity_id === search.amenity_id),
  )
  const futureReservations = queueQuery.data?.data ?? []
  const requests = futureReservations.filter(
    (reservation) => reservation.status === 'pending' || reservation.status === 'observed',
  )
  const pendingCount = requests.length

  const amenityOptions = (amenitiesQuery.data?.data ?? []).map((amenity) => ({
    value: amenity.id,
    label: amenity.name,
  }))

  function updateSearch(next: Partial<ReservationsSearchValues>) {
    void navigate({ search: (current) => ({ ...current, ...next }) })
  }

  const chips: { key: StatusChip; label: string; count?: number }[] = [
    { key: 'all', label: t('reservations.chips.all') },
    { key: 'pending', label: t('reservations.chips.pending'), count: pendingCount > 0 ? pendingCount : undefined },
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
          leftSection={<AddIcon size={18} />}
          onClick={() => setDrawerOpened(true)}
        >
          {t('reservations.newReservation')}
        </Button>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text className="min-w-0" fw={600} size="sm">
              {t('reservations.weekOf', { range: weekRangeLabel(weekStart) })}
            </Text>
            <Group className="shrink-0" gap={6} wrap="nowrap">
              <ActionIcon
                aria-label={t('reservations.previousWeek')}
                radius="md"
                size={44}
                variant="default"
                onClick={() => updateSearch({ date: addDays(weekStart, -7) })}
              >
                <AltArrowLeftIcon size={16} />
              </ActionIcon>
              <Button h={44} disabled={weekStart === startOfWeek(today)} variant="default" onClick={() => updateSearch({ date: undefined })}>
                {t('reservations.currentWeek')}
              </Button>
              <ActionIcon
                aria-label={t('reservations.nextWeek')}
                radius="md"
                size={44}
                variant="default"
                onClick={() => updateSearch({ date: addDays(weekStart, 7) })}
              >
                <AltArrowRightIcon size={16} />
              </ActionIcon>
            </Group>
          </div>
          <ReservationWeekList
            loading={weekQuery.isLoading}
            fetching={weekQuery.isPlaceholderData}
            toolbar={
              <TableToolbar
                search={<SearchInput defaultValue={search.search} placeholder={t('reservations.searchPlaceholder')} onApply={(value) => updateSearch({ search: value.trim() || undefined })} />}
                quickFilters={<QuickFilters label={t('table.quickFilters')} options={chips} value={chip} onChange={(key) => updateSearch({ status: key === 'all' ? undefined : key })} />}
                filters={
                  <FilterButton activeCount={search.amenity_id ? 1 : 0} onClearAll={() => updateSearch({ amenity_id: undefined })}>
                    <Select
                      clearable
                      comboboxProps={FILTER_COMBOBOX_PROPS}
                      label={t('reservations.columns.amenity')}
                      data={amenityOptions}
                      placeholder={t('reservations.allAmenities')}
                      value={search.amenity_id ?? null}
                      onChange={(value) => updateSearch({ amenity_id: value ?? undefined })}
                    />
                  </FilterButton>
                }
                appliedChips={search.amenity_id ? [{
                  key: 'amenity',
                  label: `${t('reservations.columns.amenity')}: ${amenityOptions.find((option) => option.value === search.amenity_id)?.label ?? t('reservations.columns.amenity')}`,
                  onRemove: () => updateSearch({ amenity_id: undefined }),
                }] : []}
                onClearAll={() => updateSearch({ amenity_id: undefined })}
              />
            }
            reservations={weekReservations}
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
        onClose={() => setDrawerOpened(false)}
      />
    </div>
  )
}

/** Search names consistently regardless of capitalization or accents. */
function normalizeSearch(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
