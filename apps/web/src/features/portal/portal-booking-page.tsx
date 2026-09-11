import { ActionIcon, Button, Loader, Select, Text } from '@mantine/core'
import { MiniCalendar } from '@mantine/dates'
import { SlotGrid } from '../../components/ui/slot-grid'
import { durationLabel, durationOptions } from '../../lib/slot-runs'
import { AltArrowLeftIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { formatMoney } from '../../lib/money'
import { notifyError, notifySuccess } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import { useActiveUnit } from './active-unit-context'
import { getAvailability, getPortalAmenities, requestReservation, type AvailabilitySlot } from './api'
import { StatusPill } from './portal-cards'
import { addDays, localDateString, MAX_ADVANCE_DAYS } from '../../lib/calendar'
import { longDate } from './presentation'

const routeApi = getRouteApi('/_authenticated/portal/reservas_/amenidades/$amenityId_/horario')

/** Elegir horario (Portal 02d): a 14-day strip, the day's slots, a summary band, one action. */
export function PortalBookingPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useMe().data
  const { amenityId } = routeApi.useParams()
  const { active } = useActiveUnit()
  const timezone = me?.active_location?.timezone ?? 'America/Lima'
  const today = localDateString(new Date(), timezone)
  const [date, setDate] = useState(today)
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)
  const [end, setEnd] = useState<string | null>(null)

  const amenities = useQuery({ queryKey: ['portal', 'amenities', active?.unit_id], queryFn: () => getPortalAmenities(active!.unit_id), enabled: active !== null })
  const amenity = amenities.data?.data.find((item) => item.id === amenityId) ?? null
  const availability = useQuery({ queryKey: ['portal', 'availability', amenityId, active?.unit_id, date], queryFn: () => getAvailability(amenityId, active!.unit_id, date), enabled: active !== null })

  const request = useMutation({
    mutationFn: () => requestReservation({ unit_id: active!.unit_id, amenity_id: amenityId, date, start: slot!.start, end: end ?? slot!.end }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'reservations'] })
      notifySuccess(t(data.status === 'approved' ? 'portal.reservations.booked' : 'portal.reservations.requested'))
      void navigate({ to: '/portal/reservas', search: { chip: 'mine' } })
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  if (!active) return null

  const mode = availability.data?.booking_mode ?? amenity?.booking_mode ?? 'approval'
  const fee = availability.data?.fee_amount_minor ?? amenity?.fee_amount_minor ?? null
  const deposit = availability.data?.deposit_amount_minor ?? amenity?.deposit_amount_minor ?? null
  const slotMinutes = availability.data?.slot_minutes ?? amenity?.slot_minutes ?? 60
  const durations = slot ? durationOptions(availability.data?.slots ?? [], slot.start) : []
  const summary = [fee ? formatMoney(fee) : t('portal.reservations.free'), deposit ? t('portal.reservations.depositOf', { amount: formatMoney(deposit) }) : null].filter(Boolean).join(' + ')

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-2">
        <ActionIcon aria-label={t('actions.back')} radius={10} size={40} variant="default" onClick={() => void navigate({ to: '/portal/reservas/amenidades/$amenityId', params: { amenityId } })}>
          <AltArrowLeftIcon size={18} />
        </ActionIcon>
        <h1 className="m-0 text-xl font-bold">{amenity?.name ?? t('portal.reservations.book')}</h1>
      </div>
      {/* Seven days at a time from today, up to the booking horizon; the
          arrows page by a week. */}
      <MiniCalendar
        aria-label={t('portal.reservations.pickDay')}
        defaultDate={today}
        maxDate={addDays(today, MAX_ADVANCE_DAYS)}
        minDate={today}
        numberOfDays={7}
        size="md"
        value={date}
        onChange={(day) => {
          setDate(day)
          setSlot(null)
          setEnd(null)
        }}
      />

      <Text fw={600} size="sm">
        {longDate(date)}
      </Text>

      {availability.isLoading ? (
        <div className="grid min-h-24 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : availability.isError ? (
        <Text c="dimmed" size="sm">
          {getErrorMessage(availability.error)}
        </Text>
      ) : (availability.data?.slots.length ?? 0) === 0 ? (
        <Text c="dimmed" className="py-4 text-center" size="sm">
          {t('portal.reservations.closedThatDay')}
        </Text>
      ) : (
        <SlotGrid
          label={t('portal.reservations.pickSlot')}
          size="md"
          slots={availability.data!.slots}
          value={slot?.start ?? ''}
          onChange={(start) => {
            setSlot(availability.data!.slots.find((item) => item.start === start) ?? null)
            setEnd(null)
          }}
        />
      )}

      {slot && durations.length > 1 ? (
        <Select
          allowDeselect={false}
          data={durations.map((option) => ({ value: option.end, label: `${durationLabel(option.slots * slotMinutes)} · ${slot.start}–${option.end}` }))}
          label={t('portal.reservations.duration')}
          value={end ?? slot.end}
          onChange={(value) => setEnd(value)}
        />
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {slot ? (
          <div className="flex items-center justify-between gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3 text-sm">
            <span>
              <span className="font-semibold">{`${longDate(date)} · ${slot.start}–${end ?? slot.end}`}</span>
              <span className="block text-xs text-[var(--mantine-color-dimmed)]">{summary}</span>
            </span>
            <StatusPill color={mode === 'instant' ? 'success' : 'warning'}>{t(`portal.reservations.status.${mode === 'instant' ? 'approved' : 'pending'}`)}</StatusPill>
          </div>
        ) : null}
        <Button className="w-full" color="accent" disabled={!slot} loading={request.isPending} size="md" onClick={() => request.mutate()}>
          {t(mode === 'instant' ? 'portal.reservations.book' : 'portal.reservations.request')}
        </Button>
      </div>
    </div>
  )
}
