import { ActionIcon, Alert, Button, Group, Skeleton, Text } from '@mantine/core'
import { AddIcon, AltArrowLeftIcon, AltArrowRightIcon } from '@solar-icons/react/linear'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import { useMe } from '../auth/hooks'
import { getLocations } from './api'
import { LocationCard } from './location-card'
import { LocationEmptyState } from './location-empty-state'
import { LocationFilters } from './location-filters'
import { LocationFormDrawer } from './location-form-drawer'

const routeApi = getRouteApi('/_authenticated/admin/locations')

export function LocationsPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const me = meQuery.data
  const account = me?.active_account

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return (
    <LocationsPageContent
      accountId={account.id}
      accountName={account.name ?? ''}
      activeLocationId={me.active_location?.id ?? null}
    />
  )
}

function LocationsPageContent({
  accountId,
  accountName,
  activeLocationId,
}: {
  accountId: string
  accountName: string
  activeLocationId: string | null
}) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const [drawerOpened, setDrawerOpened] = useState(false)

  // 10 per page instead of the API's default 15: the grid is two columns,
  // so an even page size keeps the last row full.
  const listSearch = { ...search, per_page: search.per_page ?? 10 }
  const listQuery = useQuery({
    queryKey: ['locations', 'list', accountId, listSearch],
    queryFn: () => getLocations(accountId, listSearch),
    // Page/filter changes swap tiles in place instead of dropping to a
    // loader; only the very first load shows skeletons.
    placeholderData: keepPreviousData,
  })

  function updateSearch(next: Partial<typeof search>) {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  function openCreate() {
    setDrawerOpened(true)
  }

  const locations = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const isFiltered = Boolean(search.search || search.status || search.type)

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">
            {t('locations.title')}
          </h1>
          <Text c="dimmed" mt={6} size="sm">
            {meta
              ? t('locations.subtitle', { count: meta.total, account: accountName })
              : t('common.loading')}
          </Text>
        </div>
        <Button color="accent" leftSection={<AddIcon size={20} />} onClick={openCreate}>
          {t('locations.new')}
        </Button>
      </div>

      <LocationFilters search={search} onChange={updateSearch} />

      {listQuery.isError ? (
        <Alert color="error" title={t('errors.loadFailed')}>
          {getErrorMessage(listQuery.error)}
        </Alert>
      ) : null}

      {listQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          <Skeleton height={270} radius="lg" />
          <Skeleton height={270} radius="lg" />
          <Skeleton height={270} radius="lg" />
          <Skeleton height={270} radius="lg" />
        </div>
      ) : locations.length === 0 && !listQuery.isError ? (
        <LocationEmptyState
          filtered={isFiltered}
          onClearFilters={() => updateSearch({ search: '', status: '', type: '' })}
          onCreate={openCreate}
        />
      ) : (
        <div
          className={`grid grid-cols-1 gap-4 @3xl:grid-cols-2 ${listQuery.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              isActiveLocation={location.id === activeLocationId}
              location={location}
              onOpen={() =>
                void navigate({
                  to: '/admin/locations/$locationId',
                  params: { locationId: location.id },
                  search: { tab: 'info' },
                })
              }
            />
          ))}
        </div>
      )}

      {meta && meta.last_page > 1 ? (
        <Group gap={6} justify="flex-end">
          <Text c="dimmed" size="sm">
            {t('table.showing', {
              from: (meta.current_page - 1) * meta.per_page + 1,
              to: (meta.current_page - 1) * meta.per_page + locations.length,
              total: meta.total,
            })}
          </Text>
          <ActionIcon
            aria-label={t('table.previousPage')}
            disabled={meta.current_page <= 1}
            radius="md"
            size={32}
            variant="default"
            onClick={() => updateSearch({ page: meta.current_page - 1 })}
          >
            <AltArrowLeftIcon size={16} />
          </ActionIcon>
          <ActionIcon
            aria-label={t('table.nextPage')}
            disabled={meta.current_page >= meta.last_page}
            radius="md"
            size={32}
            variant="default"
            onClick={() => updateSearch({ page: meta.current_page + 1 })}
          >
            <AltArrowRightIcon size={16} />
          </ActionIcon>
        </Group>
      ) : null}

      <LocationFormDrawer
        accountId={accountId}
        editing={null}
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
      />
    </div>
  )
}
