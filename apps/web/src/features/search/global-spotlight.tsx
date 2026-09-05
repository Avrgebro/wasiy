import { Loader } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { Spotlight, spotlight } from '@mantine/spotlight'
import { Magnifer } from '@solar-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LayoutNavEntry, LayoutNavLeaf } from '../../components/layout/shared/types'
import { useMe } from '../auth/hooks'
import { searchLocation, type SearchHit } from './api'

const MIN_QUERY = 2

/** Every page the sidebar offers this user, flattened; the spotlight doubles as a command palette. */
function pageLeaves(navItems: LayoutNavEntry[]): LayoutNavLeaf[] {
  return navItems.flatMap((entry) => {
    if ('type' in entry && entry.type === 'group') return pageLeaves(entry.items)
    if ('type' in entry && entry.type === 'collapsible') return entry.children
    return [entry as LayoutNavLeaf]
  })
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * ⌘K search over the active Location: pages from the nav tree, then the
 * API's grouped hits (units, residents, visits, packages), each opening the
 * page that shows it. Which groups exist is the API's call, so the desk never
 * sees a units group here either.
 */
export function GlobalSpotlight({ navItems }: { navItems: LayoutNavEntry[] }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const me = useMe().data
  const locationId = me?.active_location?.id ?? null
  const [query, setQuery] = useState('')
  const [debounced] = useDebouncedValue(query.trim(), 250)
  const ready = debounced.length >= MIN_QUERY && locationId !== null

  const results = useQuery({
    queryKey: ['locations', locationId, 'search', debounced],
    queryFn: () => searchLocation(locationId ?? '', debounced),
    enabled: ready,
    staleTime: 30_000,
  })

  const pages = pageLeaves(navItems).filter((leaf) => query.trim().length > 0 && normalize(t(leaf.labelKey)).includes(normalize(query)))

  function open(hit: SearchHit) {
    spotlight.close()
    switch (hit.to.page) {
      case 'unit':
        void navigate({ to: '/admin/registry/units/$unitId', params: { unitId: hit.to.unit_id } })
        return
      case 'resident':
        void navigate({ to: '/admin/registry/residents', search: { search: hit.label, page: 1, portal: '', status: '' } })
        return
      case 'visit':
        void navigate({ to: '/admin/visitors', search: { search: hit.label, page: 1, confirmation: '', chip: 'today' } })
        return
      case 'package':
        void navigate({ to: '/admin/packages', search: { search: hit.label, page: 1, chip: 'pending' } })
    }
  }

  const groups = results.data?.groups ?? []
  const nothing = query.trim().length >= MIN_QUERY && !results.isFetching && pages.length === 0 && groups.length === 0

  return (
    <Spotlight.Root
      query={query}
      onQueryChange={setQuery}
      onSpotlightClose={() => setQuery('')}
      shortcut={['mod + K']}
    >
      <Spotlight.Search
        leftSection={<Magnifer size={18} />}
        placeholder={t('search.placeholder')}
        rightSection={results.isFetching ? <Loader size={16} /> : null}
      />
      <Spotlight.ActionsList>
        {pages.length > 0 ? (
          <Spotlight.ActionsGroup label={t('search.groups.pages')}>
            {pages.map((leaf) => (
              <Spotlight.Action
                key={leaf.to}
                label={t(leaf.labelKey)}
                leftSection={<leaf.icon size={18} />}
                onClick={() => {
                  spotlight.close()
                  void navigate({ to: leaf.to })
                }}
              />
            ))}
          </Spotlight.ActionsGroup>
        ) : null}
        {groups.map((group) => (
          <Spotlight.ActionsGroup key={group.key} label={t(`search.groups.${group.key}`)}>
            {group.items.map((hit) => (
              <Spotlight.Action key={hit.id} description={hit.description ?? undefined} label={hit.label} onClick={() => open(hit)} />
            ))}
          </Spotlight.ActionsGroup>
        ))}
        {query.trim().length < MIN_QUERY && pages.length === 0 ? <Spotlight.Empty>{t('search.hint')}</Spotlight.Empty> : null}
        {nothing ? <Spotlight.Empty>{t('search.nothingFound', { query: query.trim() })}</Spotlight.Empty> : null}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  )
}
