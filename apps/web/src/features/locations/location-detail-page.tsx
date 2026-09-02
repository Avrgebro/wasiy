import { Alert, Button, Skeleton, Tabs, Text } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { Buildings2, CameraMinimalistic, DangerTriangle } from '@solar-icons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../app/api-client'
import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'
import { getErrorMessage } from '../../lib/errors'
import { useMe } from '../auth/hooks'
import {
  getLocation,
  getLocationSettings,
  reactivateLocation,
  updateLocationSettings,
  type LocationSummary,
} from './api'
import { LocationAmenitiesTab } from './location-amenities-tab'
import { LocationCoverPlaceholder } from './location-cover-placeholder'
import { LocationDeactivateModal } from './location-deactivate-modal'
import { LocationFormDrawer } from './location-form-drawer'
import { LocationInfoTab } from './location-info-tab'
import { LocationStaffTab } from './location-staff-tab'
import { OperationalSettingsPanel } from './operational-settings'
import type { LocationDetailTab } from './schemas'

const routeApi = getRouteApi('/_authenticated/admin/locations_/$locationId')

export function LocationDetailPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const account = me?.active_account

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return <LocationDetailContent accountId={account.id} />
}

function LocationDetailContent({ accountId }: { accountId: string }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const { locationId } = routeApi.useParams()
  const { tab } = routeApi.useSearch()
  const queryClient = useQueryClient()
  const [drawerOpened, setDrawerOpened] = useState(false)
  const [deactivating, setDeactivating] = useState<LocationSummary | null>(null)

  const detailQuery = useQuery({
    queryKey: ['locations', 'detail', accountId, locationId],
    queryFn: () => getLocation(accountId, locationId),
    retry: false,
  })

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateLocation(accountId, locationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['locations'] })
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
      showNotification({ color: 'green', message: t('locations.reactivated') })
    },
    onError: (error) => {
      showNotification({ color: 'red', message: getErrorMessage(error) })
    },
  })

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton height={220} radius="lg" />
        <Skeleton height={44} radius="md" />
        <Skeleton height={320} radius="lg" />
      </div>
    )
  }

  if (detailQuery.isError) {
    const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404

    return (
      <div className="grid min-h-96 place-items-center text-center">
        <div className="flex flex-col items-center gap-2">
          <Buildings2 className="text-[var(--mantine-color-dimmed)]" size={30} />
          <Text fw={700}>
            {notFound ? t('locations.detail.notFoundTitle') : t('errors.loadFailed')}
          </Text>
          <Text c="dimmed" size="sm">
            {notFound
              ? t('locations.detail.notFoundBody')
              : getErrorMessage(detailQuery.error)}
          </Text>
          <Link className="mt-1 font-semibold text-[var(--wa-interactive)] no-underline" to="/admin/locations">
            {t('locations.detail.backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const location = detailQuery.data!.data
  const deactivated = location.status === 'deactivated'

  return (
    <div className="@container flex flex-col gap-5">
      <nav className="flex items-center gap-2 text-[13.5px] text-[var(--mantine-color-dimmed)]">
        <Link className="text-[var(--wa-interactive)] no-underline" to="/admin/locations">
          {t('locations.title')}
        </Link>
        <span>/</span>
        <span className="font-semibold text-[var(--mantine-color-text)]">{location.name}</span>
      </nav>

      <header className="relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-[14px] bg-[var(--wa-surface-2)]">
        {location.cover_photo_url ? (
          <img alt="" className="absolute inset-0 size-full object-cover" src={location.cover_photo_url} />
        ) : (
          <LocationCoverPlaceholder logoSize={280} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.55)] via-transparent to-transparent" />
        {!deactivated && (
          <button
            className="absolute right-4 top-4 flex cursor-pointer items-center gap-[7px] rounded-lg border border-[#2A3F40] bg-[rgba(16,29,30,0.85)] px-[13px] py-2 text-[12.5px] font-semibold text-[#E9ECE8]"
            type="button"
            onClick={() => {
              void navigate({
                params: { locationId },
                search: { tab: 'info' as LocationDetailTab },
              }).then(() => {
                requestAnimationFrame(() => {
                  document
                    .getElementById('location-photos')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                })
              })
            }}
          >
            <CameraMinimalistic size={15} />
            {t('locations.detail.changeCover')}
          </button>
        )}
        {/* In flow (not absolute) so on narrow screens the actions wrap
            below the name instead of overlapping it. */}
        <div className="relative flex flex-wrap items-end justify-between gap-3 px-4 pb-[18px] pt-8 sm:px-6">
          <div className="flex min-w-0 items-end gap-4">
            {/* Brand tile stands in for the location avatar for now (mockup 03). */}
            <div className="grid size-16 shrink-0 place-items-center rounded-[14px] border border-[#2A3F40] bg-[#124E52] text-[#F7F5F0]">
              <WasiyLogo size={34} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[26px] font-semibold tracking-tight text-white">
                  {location.name}
                </span>
                {/* The header always sits on a photo/dark cover, so the pill keeps
                    the mockup's dark-surface colors in both themes. */}
                <span
                  className={`rounded-full bg-[rgba(29,51,53,0.9)] px-[11px] py-1 text-[11.5px] font-semibold ${
                    deactivated ? 'text-[#9FB0AE]' : 'text-[#6FBF97]'
                  }`}
                >
                  {t(`locations.statuses.${location.status}`)}
                </span>
              </div>
              <Text c="gray.3" mt={4} size="sm">
                {[location.formatted_address, location.timezone].filter(Boolean).join(' · ')}
              </Text>
            </div>
          </div>
          {deactivated ? (
            <Button
              color="accent"
              loading={reactivateMutation.isPending}
              onClick={() => reactivateMutation.mutate()}
            >
              {t('locations.detail.reactivateLocation')}
            </Button>
          ) : (
            <Button color="accent" onClick={() => setDrawerOpened(true)}>
              {t('locations.editTitle')}
            </Button>
          )}
        </div>
      </header>

      {deactivated ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-[var(--wa-warning)]/50 bg-[var(--wa-warning)]/10 px-[18px] py-3.5">
          <DangerTriangle className="shrink-0 text-[var(--wa-warning)]" size={22} />
          <div className="min-w-0 flex-1">
            <Text fw={600} size="sm">
              {t('locations.detail.deactivatedTitle')}
            </Text>
            <Text c="dimmed" mt={2} size="xs">
              {t('locations.detail.deactivatedBody', {
                name: location.deactivated_by?.name ?? '—',
                date: location.deactivated_at
                  ? new Date(location.deactivated_at).toLocaleDateString()
                  : '—',
              })}
            </Text>
          </div>
          <Button
            color="accent"
            loading={reactivateMutation.isPending}
            size="xs"
            onClick={() => reactivateMutation.mutate()}
          >
            {t('locations.reactivate')}
          </Button>
        </div>
      ) : null}

      <Tabs
        keepMounted={false}
        value={tab}
        onChange={(value) =>
          void navigate({
            params: { locationId },
            search: { tab: (value ?? 'info') as LocationDetailTab },
          })
        }
      >
        <Tabs.List>
          <Tabs.Tab value="info">{t('locations.tabs.info')}</Tabs.Tab>
          <Tabs.Tab value="amenities">{t('locations.tabs.amenities')}</Tabs.Tab>
          <Tabs.Tab value="staff">{t('locations.tabs.staff')}</Tabs.Tab>
          <Tabs.Tab value="settings">{t('locations.tabs.settings')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel pt="lg" value="info">
          <LocationInfoTab
            accountId={accountId}
            location={location}
            onEdit={() => setDrawerOpened(true)}
          />
        </Tabs.Panel>
        <Tabs.Panel pt="lg" value="amenities">
          <LocationAmenitiesTab
            accountId={accountId}
            locationId={location.id}
            readOnly={deactivated}
            timezone={location.timezone}
          />
        </Tabs.Panel>
        <Tabs.Panel pt="lg" value="staff">
          <LocationStaffTab accountId={accountId} locationId={location.id} />
        </Tabs.Panel>
        <Tabs.Panel pt="lg" value="settings">
          <OperationalSettingsPanel
            fetchSettings={() => getLocationSettings(accountId, location.id)}
            level="location"
            readOnly={deactivated}
            saveSettings={(payload) => updateLocationSettings(accountId, location.id, payload)}
            scopeName={location.name}
            settingsQueryKey={['locations', 'settings', accountId, location.id]}
            timezone={location.timezone}
          />
        </Tabs.Panel>
      </Tabs>

      <LocationFormDrawer
        accountId={accountId}
        editing={location}
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        onDeactivate={
          deactivated
            ? undefined
            : () => {
                setDrawerOpened(false)
                setDeactivating(location)
              }
        }
      />
      <LocationDeactivateModal
        accountId={accountId}
        location={deactivating}
        onClose={() => setDeactivating(null)}
      />
    </div>
  )
}


