import { Button, Text } from '@mantine/core'
import { Pen } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { formatPhone } from '../../lib/phone'
import type { LocationSummary } from './api'
import { LocationPhotoGallery } from './location-photo-gallery'

function StatCard({ accent, label, value }: { accent?: boolean; label: string; value: number }) {
  return (
    <div className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-[18px] py-3.5">
      <div
        className={`text-2xl font-semibold ${
          accent ? 'text-[var(--wa-warning)]' : 'text-[var(--mantine-color-text)]'
        }`}
      >
        {value}
      </div>
      <Text c="dimmed" mt={2} size="xs">
        {label}
      </Text>
    </div>
  )
}

function InfoField({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div
      className={`border-b border-[var(--mantine-color-default-border)] px-5 py-3 ${
        wide ? 'col-span-full' : ''
      }`}
    >
      <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">
        {label}
      </div>
      <div className="mt-1 text-sm leading-relaxed text-[var(--mantine-color-text)]">
        {value ?? '—'}
      </div>
    </div>
  )
}

/**
 * The Información tab (mockup 03): stats row, the read view of identity and
 * address with its Editar affordance, and the photo gallery.
 */
export function LocationInfoTab({
  accountId,
  location,
  onEdit,
}: {
  accountId: string
  location: LocationSummary
  onEdit: () => void
}) {
  const { t } = useTranslation('common')
  const readOnly = location.status === 'deactivated'

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3.5 @2xl:grid-cols-3 @5xl:grid-cols-5">
        <StatCard label={t('locations.stats.units')} value={location.units_count} />
        <StatCard label={t('locations.stats.residents')} value={location.residents_count} />
        <StatCard label={t('locations.stats.vehicles')} value={location.vehicles_count} />
        <StatCard
          accent
          label={t('locations.stats.unclaimedInvitations')}
          value={location.unclaimed_invitations_count}
        />
        <StatCard label={t('locations.stats.activeAmenities')} value={location.active_amenities_count} />
      </div>

      <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--mantine-color-default-border)] px-5 py-4">
          <Text fw={600}>{t('locations.info.title')}</Text>
          {readOnly ? (
            <Text c="dimmed" size="xs">
              {t('locations.info.editBlocked')}
            </Text>
          ) : (
            <Button leftSection={<Pen size={13} />} size="xs" variant="default" onClick={onEdit}>
              {t('actions.edit')}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 @2xl:grid-cols-3">
          <InfoField label={t('locations.form.name')} value={location.name} />
          <InfoField label={t('locations.form.type')} value={t(`locations.types.${location.type}`)} />
          <InfoField label={t('locations.form.timezone')} value={location.timezone} />
          <InfoField label={t('locations.form.addressLine1')} value={location.address_line1} />
          <InfoField label={t('locations.form.addressLine2')} value={location.address_line2} />
          <InfoField label={t('locations.form.city')} value={location.city} />
          <InfoField label={t('locations.form.state')} value={location.state} />
          <InfoField label={t('locations.form.postalCode')} value={location.postal_code} />
          <InfoField label={t('locations.form.country')} value={location.country} />
          <InfoField label={t('locations.form.phone')} value={location.phone ? formatPhone(location.phone, location.country) : null} />
          <InfoField label={t('locations.form.contactEmail')} value={location.contact_email} />
          <InfoField label={t('locations.form.district')} value={location.district} />
          <InfoField wide label={t('locations.form.accessNotes')} value={location.access_notes} />
        </div>
      </section>

      <LocationPhotoGallery
        accountId={accountId}
        locationId={location.id}
        photos={location.photos ?? []}
        readOnly={readOnly}
      />
    </div>
  )
}
