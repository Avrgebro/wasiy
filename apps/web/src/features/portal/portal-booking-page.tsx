import { ActionIcon, Button, Loader, Text } from '@mantine/core'
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
import { dayStripLabel, longDate, upcomingDays } from './presentation'

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
  const days = upcomingDays(new Date(), timezone)
  const [date, setDate] = useState(days[0])
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)

  const amenities = useQuery({ queryKey: ['portal', 'amenities', active?.unit_id], queryFn: () => getPortalAmenities(active!.unit_id), enabled: active !== null })
  const amenity = amenities.data?.data.find((item) => item.id === amenityId) ?? null
  const availability = useQuery({ queryKey: ['portal', 'availability', amenityId, active?.unit_id, date], queryFn: () => getAvailability(amenityId, active!.unit_id, date), enabled: active !== null })

  const request = useMutation({
    mutationFn: () => requestReservation({ unit_id: active!.unit_id, amenity_id: amenityId, date, start: slot!.start, end: slot!.end }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ['portal', 'reservations'] })
      notifySuccess(t(data.status === 'approved' ? 'portal.reservations.booked' : 'portal.reservations.requested'))
      void navigate({ to: '/portal/reservas', search: { chip: 'mine' } })
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  if (!active) return null

  const mode = availability.data?.booking_mode ?? amenity?.booking_mode ?? 'approval'
  const fee = availability.data?.fee_amount ?? amenity?.fee_amount ?? null
  const deposit = availability.data?.deposit_amount ?? amenity?.deposit_amount ?? null
  const summary = [fee ? formatMoney(fee) : t('portal.reservations.free'), deposit ? t('portal.reservations.depositOf', { amount: formatMoney(deposit) }) : null].filter(Boolean).join(' + ')

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-2">
        <ActionIcon aria-label={t('actions.back')} radius={10} size={40} variant="default" onClick={() => void navigate({ to: '/portal/reservas/amenidades/$amenityId', params: { amenityId } })}>
          <AltArrowLeftIcon size={18} />
        </ActionIcon>
        <h1 className="m-0 text-xl font-bold">{amenity?.name ?? t('portal.reservations.book')}</h1>
      </div>
      <Text c="dimmed" size="sm">
        {t('portal.reservations.slotsIntro')}
      </Text>

      <div className="-mx-4 overflow-x-auto px-4" role="listbox" aria-label={t('portal.reservations.pickDay')}>
        <div className="flex gap-2">
          {days.map((day) => {
            const label = dayStripLabel(day)
            const selected = day === date

            return (
              <button
                key={day}
                aria-selected={selected}
                className={`flex min-w-11 flex-col items-center rounded-inner border px-2 py-2 text-xs ${selected ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]' : 'border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] text-[var(--mantine-color-dimmed)]'}`}
                role="option"
                type="button"
                onClick={() => {
                  setDate(day)
                  setSlot(null)
                }}
              >
                <span className="font-semibold">{label.weekday}</span>
                <span className="text-sm font-bold">{label.day}</span>
              </button>
            )
          })}
        </div>
      </div>

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
        <ul className="m-0 flex list-none flex-col gap-2 p-0" role="listbox" aria-label={t('portal.reservations.pickSlot')}>
          {availability.data!.slots.map((item) => {
            const selected = slot?.start === item.start

            return (
              <li key={item.start}>
                <button
                  aria-selected={selected}
                  className={`flex min-h-12 w-full items-center justify-between rounded-inner border px-4 text-left text-sm font-semibold ${selected ? 'border-[var(--wa-interactive)] bg-[var(--wa-surface-2)]' : 'border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)]'} ${item.available ? '' : 'opacity-60'}`}
                  disabled={!item.available}
                  role="option"
                  type="button"
                  onClick={() => setSlot(item)}
                >
                  <span>
                    {item.start}–{item.end}
                  </span>
                  {!item.available ? <StatusPill color="gray">{t(`portal.reservations.slotReason.${item.reason ?? 'taken'}`)}</StatusPill> : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {slot ? (
          <div className="flex items-center justify-between gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-3.5 py-3 text-sm">
            <span>
              <span className="font-semibold">{`${dayStripLabel(date).weekday.toLowerCase()} ${dayStripLabel(date).day} · ${slot.start}–${slot.end}`}</span>
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
