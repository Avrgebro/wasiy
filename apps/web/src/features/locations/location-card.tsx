import { Badge, Text } from '@mantine/core'
import { Buildings2 } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import type { LocationSummary } from './api'

function CountStat({ accent, label, value }: { accent?: boolean; label: string; value: number }) {
  return (
    <span
      className={
        accent
          ? 'text-xs text-[var(--wa-warning)]'
          : 'text-xs text-[var(--mantine-color-dimmed)]'
      }
    >
      <strong className={accent ? '' : 'text-[var(--mantine-color-text)]'}>{value}</strong>{' '}
      {label}
    </span>
  )
}

/**
 * One card of the locations grid (mockup 02) — the deliberate exception to
 * tables in the admin surface: a full-width cover banner, the active
 * location pill overlaid on it, name and status, address, and the count
 * row with unclaimed invitations called out in amber.
 */
export function LocationCard({
  isActiveLocation,
  location,
  onOpen,
}: {
  isActiveLocation: boolean
  location: LocationSummary
  onOpen: () => void
}) {
  const { t } = useTranslation('common')
  const deactivated = location.status === 'deactivated'

  return (
    <article
      className={`relative overflow-hidden rounded-[14px] border bg-[var(--mantine-color-default)] transition-colors ${
        isActiveLocation
          ? 'border-[var(--wa-secondary)]'
          : 'border-[var(--mantine-color-default-border)] hover:border-[var(--wa-secondary)]'
      } ${deactivated ? 'opacity-70' : ''}`}
    >
      <button
        aria-label={location.name}
        className="m-0 block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        type="button"
        onClick={onOpen}
      >
        <div className="relative h-[130px] overflow-hidden bg-[var(--wa-surface-2)]">
          {location.cover_photo_url ? (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              src={location.cover_photo_url}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[var(--mantine-color-dimmed)]">
              <div className="flex flex-col items-center gap-1">
                <Buildings2 size={24} />
                <Text c="dimmed" size="xs">
                  {t('locations.noPhotos')}
                </Text>
              </div>
            </div>
          )}
          {isActiveLocation ? (
            <span className="absolute left-3.5 top-3 flex items-center gap-1.5 rounded-full border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-body)]/90 px-3 py-1 text-[11.5px] font-semibold text-[var(--wa-interactive)]">
              <span className="size-1.5 rounded-full bg-[var(--wa-success)]" />
              {t('locations.activeLocation')}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 px-5 py-[18px]">
          <div className="flex items-start justify-between gap-3">
            <Text fw={600} size="lg" truncate>
              {location.name}
            </Text>
            <Badge
              color={deactivated ? 'gray' : 'success'}
              radius="xl"
              size="sm"
              variant="light"
            >
              {t(`locations.statuses.${location.status}`)}
            </Badge>
          </div>
          <Text c="dimmed" size="sm" truncate>
            {location.formatted_address ?? '—'}
          </Text>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <CountStat label={t('locations.counts.units')} value={location.units_count} />
            <CountStat label={t('locations.counts.residents')} value={location.residents_count} />
            <CountStat label={t('locations.counts.vehicles')} value={location.vehicles_count} />
            <CountStat label={t('locations.counts.staff')} value={location.staff_count} />
            <CountStat
              accent
              label={t('locations.counts.unclaimedInvitations')}
              value={location.unclaimed_invitations_count}
            />
          </div>
        </div>
      </button>
    </article>
  )
}
