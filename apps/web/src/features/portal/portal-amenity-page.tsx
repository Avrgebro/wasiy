import { ActionIcon, Button, Loader, Text } from '@mantine/core'
import { AltArrowLeftIcon } from '@solar-icons/react/linear'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DrawerFact, DrawerFacts } from '../../components/ui/detail-drawer-parts'
import { formatMoney } from '../../lib/money'
import { useActiveUnit } from './active-unit-context'
import { getPortalAmenities } from './api'
import { StatusPill } from './portal-cards'

const routeApi = getRouteApi('/_authenticated/portal/reservas_/amenidades/$amenityId')

/** Detalle de amenidad (Portal 02c): terms first, then the one action. */
export function PortalAmenityPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { amenityId } = routeApi.useParams()
  const { active } = useActiveUnit()
  const amenities = useQuery({ queryKey: ['portal', 'amenities', active?.unit_id], queryFn: () => getPortalAmenities(active!.unit_id), enabled: active !== null })
  const amenity = amenities.data?.data.find((item) => item.id === amenityId) ?? null

  if (amenities.isLoading || !active) {
    return (
      <div className="grid min-h-40 place-items-center">
        <Loader aria-label={t('common.loading')} />
      </div>
    )
  }
  if (!amenity) {
    return (
      <Text c="dimmed" size="sm">
        {t('portal.reservations.amenityMissing')}
      </Text>
    )
  }

  const hours = (minutes: number) => (minutes % 60 === 0 ? t('portal.reservations.hours', { count: minutes / 60 }) : t('portal.reservations.minutes', { count: minutes }))

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-2">
        <ActionIcon aria-label={t('actions.back')} radius={10} size={40} variant="default" onClick={() => void navigate({ to: '/portal/reservas', search: { chip: 'amenidades' } })}>
          <AltArrowLeftIcon size={18} />
        </ActionIcon>
        <h1 className="m-0 text-xl font-bold">{amenity.name}</h1>
      </div>

      <div className="relative h-44 overflow-hidden rounded-surface bg-[var(--wa-surface-2)]">
        {amenity.cover_photo_url ? <img alt="" className="h-full w-full object-cover" src={amenity.cover_photo_url} /> : null}
        <span className="absolute top-2.5 left-2.5">
          <StatusPill color={amenity.booking_mode === 'instant' ? 'teal' : 'warning'}>{t(`portal.reservations.mode.${amenity.booking_mode}`)}</StatusPill>
        </span>
      </div>

      {amenity.description ? <Text size="sm">{amenity.description}</Text> : null}

      <DrawerFacts>
        <DrawerFact label={t('portal.reservations.slotLength')} value={hours(amenity.slot_minutes)} />
        <DrawerFact label={t('portal.reservations.fee')} value={amenity.fee_amount_minor ? formatMoney(amenity.fee_amount_minor) : t('portal.reservations.free')} />
        <DrawerFact label={t('portal.reservations.deposit')} value={amenity.deposit_amount_minor ? formatMoney(amenity.deposit_amount_minor) : '—'} />
        <DrawerFact label={t('portal.reservations.cancellation')} value={t('portal.reservations.cancelUntilStart')} />
      </DrawerFacts>

      <div className="mt-auto pt-2">
        <Button className="w-full" color="accent" size="md" onClick={() => void navigate({ to: '/portal/reservas/amenidades/$amenityId/horario', params: { amenityId: amenity.id } })}>
          {t('portal.reservations.book')}
        </Button>
      </div>
    </div>
  )
}
