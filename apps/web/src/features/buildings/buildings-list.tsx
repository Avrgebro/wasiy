import { ActionIcon, Alert, Button, Skeleton, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { AddIcon, BuildingsIcon, CheckCircleIcon, CloseCircleIcon, PenIcon, TrashBinTrashIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { buildingsQueryKey, createBuilding, deleteBuilding, getBuildings, updateBuilding, type BuildingSummary } from './api'

/**
 * The location's towers card (ADR 0037, mockup 06). Every location owns one
 * building row from birth, but a single-tower location must not look like a
 * half-filled form, so the default row stays hidden behind a switch: off = one
 * tower, units show no tower. Turning it on names the existing tower and
 * creates the second in one save (existing units stay in the first). With two
 * or more towers the switch stays on and a grid of tiles appears: rename in
 * place, unit counts, add, delete when empty. Turning it back off deletes the
 * empty extra towers and clears the first tower's name — only possible while
 * those towers hold no units.
 */
export function BuildingsList({ locationId, readOnly = false }: { locationId: string; readOnly?: boolean }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<BuildingSummary | null>(null)

  const query = useQuery({ queryKey: buildingsQueryKey(locationId), queryFn: () => getBuildings(locationId) })
  const buildings = query.data?.data ?? []

  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: buildingsQueryKey(locationId) }),
      queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
    ])
  }

  const remove = useMutation({
    mutationFn: (building: BuildingSummary) => deleteBuilding(building.id),
    onSuccess: async () => {
      await refresh()
      setDeleting(null)
      notifySuccess(t('buildings.removed'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })
  // Back to one tower: drop the empty extras, then unname the first.
  const collapse = useMutation({
    mutationFn: async () => {
      const [first, ...rest] = buildings
      for (const building of rest) await deleteBuilding(building.id)
      await updateBuilding(first.id, { name: null })
    },
    onSuccess: async () => {
      await refresh()
      setDisabling(false)
      notifySuccess(t('buildings.collapsed'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  if (query.isLoading) {
    return (
      <Card subtitle={t('buildings.multiHint')}>
        <Skeleton height={44} radius="sm" width="60%" />
        <Rule />
        <TileGrid>
          <Skeleton height={42} radius="sm" />
          <Skeleton height={42} radius="sm" />
        </TileGrid>
      </Card>
    )
  }

  if (query.isError) {
    return (
      <Card subtitle={t('buildings.multiHint')}>
        <Alert color="error" title={t('buildings.loadFailed')}>
          <p>{getErrorMessage(query.error)}</p>
          <Button className="mt-3" variant="default" onClick={() => void query.refetch()}>
            {t('router.retry')}
          </Button>
        </Alert>
      </Card>
    )
  }

  const single = buildings.length === 1
  const unitsInOthers = buildings.slice(1).reduce((sum, building) => sum + building.units_count, 0)
  const canCollapse = !single && unitsInOthers === 0
  const multi = !single || enabling
  const subtitle = readOnly ? t('buildings.readOnlyHint') : single ? t('buildings.singleHint') : t('buildings.multiHint')

  return (
    <Card
      footer={
        !single ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {!readOnly && !adding ? (
              <Button leftSection={<AddIcon size={18} />} variant="default" onClick={() => setAdding(true)}>
                {t('buildings.add')}
              </Button>
            ) : (
              <span />
            )}
            <Hint>{canCollapse || readOnly ? t('buildings.renameHint') : t('buildings.collapseHint')}</Hint>
          </div>
        ) : undefined
      }
      subtitle={subtitle}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Text fw={600} size="sm">
            {t('buildings.toggle')}
          </Text>
          <Text c="dimmed" size="xs">
            {t('buildings.toggleHint')}
          </Text>
        </div>
        {readOnly ? (
          <Text c="dimmed" size="sm">
            {multi ? t('buildings.on') : t('buildings.off')}
          </Text>
        ) : (
          <Tooltip disabled={single || canCollapse} label={t('buildings.collapseBlocked', { count: unitsInOthers })}>
            <span className="inline-flex shrink-0">
              <Switch
                aria-label={t('buildings.toggle')}
                checked={multi}
                disabled={!single && !canCollapse}
                onChange={(event) => {
                  if (event.currentTarget.checked) setEnabling(true)
                  else if (single) setEnabling(false)
                  else setDisabling(true)
                }}
              />
            </span>
          </Tooltip>
        )}
      </div>

      {single && enabling ? (
        <>
          <Rule />
          <EnableTowersForm
            first={buildings[0]}
            onCancel={() => setEnabling(false)}
            onSaved={async () => {
              await refresh()
              setEnabling(false)
            }}
          />
        </>
      ) : null}

      {!single ? (
        <>
          <Rule />
          <TileGrid>
            {buildings.map((building) => (
              <BuildingTile
                key={building.id}
                building={building}
                canDelete={!readOnly && building.units_count === 0}
                deleteHint={building.units_count > 0 ? t('buildings.inUse', { count: building.units_count }) : undefined}
                readOnly={readOnly}
                onDelete={() => setDeleting(building)}
                onSaved={refresh}
              />
            ))}
            {adding ? (
              <AddTowerTile
                locationId={locationId}
                onCancel={() => setAdding(false)}
                onSaved={async () => {
                  await refresh()
                  setAdding(false)
                }}
              />
            ) : null}
          </TileGrid>
        </>
      ) : null}

      <ConfirmDialog
        body={t('buildings.confirmDeleteBody')}
        opened={deleting !== null}
        title={t('buildings.confirmDeleteTitle', { name: deleting?.name ?? '' })}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
      <ConfirmDialog
        body={t('buildings.confirmCollapseBody', { count: buildings.length - 1 })}
        opened={disabling}
        title={t('buildings.confirmCollapseTitle')}
        onCancel={() => setDisabling(false)}
        onConfirm={() => collapse.mutate()}
      />
    </Card>
  )
}

/** The section card: header band with title and state subtitle, body, optional footer row. */
function Card({ children, footer, subtitle }: { children: ReactNode; footer?: ReactNode; subtitle: string }) {
  const { t } = useTranslation('common')
  return (
    <section className="overflow-hidden rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <div className="border-b border-[var(--mantine-color-default-border)] px-5 py-4">
        <h3 className="m-0 font-display text-base font-semibold text-[var(--mantine-color-text)]">{t('buildings.title')}</h3>
        <Text c="dimmed" size="xs">
          {subtitle}
        </Text>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {children}
        {footer}
      </div>
    </section>
  )
}

function Rule() {
  return <div aria-hidden className="h-px bg-[var(--mantine-color-default-border)]" />
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <Text c="dimmed" className="inline-flex items-center gap-2" size="xs">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--wa-interactive)]" />
      {children}
    </Text>
  )
}

/** Tiles fill the card in as many 320px columns as fit, one per row on phones. */
function TileGrid({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-2.5 p-0">{children}</ul>
}

const tileClass =
  'flex min-h-[42px] items-center gap-2.5 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] py-1.5 pl-2.5 pr-1.5'

function TileIcon() {
  return (
    <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-[var(--wa-tint)] text-[var(--wa-interactive)]">
      <BuildingsIcon size={15} />
    </span>
  )
}

/**
 * First-time split: name the existing tower and the new one, then one save
 * renames the first (its units come along by reference) and creates the
 * second. The footer bar bleeds to the card edges like the mockup.
 */
function EnableTowersForm({ first, onCancel, onSaved }: { first: BuildingSummary; onCancel: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation('common')
  const [firstName, setFirstName] = useState(first.name ?? '')
  const [secondName, setSecondName] = useState('')
  const ready = firstName.trim() !== '' && secondName.trim() !== ''

  const save = useMutation({
    mutationFn: async () => {
      await updateBuilding(first.id, { name: firstName.trim() })
      await createBuilding(first.location_id, { name: secondName.trim() })
    },
    onSuccess: async () => {
      await onSaved()
      notifySuccess(t('buildings.enabled'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  return (
    <form
      className="-mx-5 -mb-5 flex flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) save.mutate()
      }}
    >
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <TextInput
            autoFocus
            label={t('buildings.firstTower')}
            placeholder={t('buildings.firstTowerPlaceholder')}
            required
            value={firstName}
            onChange={(event) => setFirstName(event.currentTarget.value)}
          />
          <TextInput
            label={t('buildings.secondTower')}
            placeholder={t('buildings.secondTowerPlaceholder')}
            required
            value={secondName}
            onChange={(event) => setSecondName(event.currentTarget.value)}
          />
        </div>
        <Hint>{t('buildings.enableNotice', { count: first.units_count })}</Hint>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-5 py-3">
        <Text c="dimmed" size="xs">
          {t('buildings.willCreateSecond')}
        </Text>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="subtle" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
          <Button color="accent" disabled={!ready} loading={save.isPending} size="xs" type="submit">
            {t('actions.save')}
          </Button>
        </div>
      </div>
    </form>
  )
}

/** One tower: icon, name (click or pencil to rename in place), unit count, rename and delete. */
function BuildingTile({
  building,
  canDelete,
  deleteHint,
  onDelete,
  onSaved,
  readOnly,
}: {
  building: BuildingSummary
  canDelete: boolean
  deleteHint?: string
  onDelete: () => void
  onSaved: () => Promise<unknown>
  readOnly: boolean
}) {
  const { t } = useTranslation('common')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(building.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const label = building.name ?? t('buildings.unnamed')

  const save = useMutation({
    mutationFn: () => updateBuilding(building.id, { name: name.trim() }),
    onSuccess: async () => {
      setError(null)
      await onSaved()
      setEditing(false)
      notifySuccess(t('buildings.saved'))
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  function startEditing() {
    setName(building.name ?? '')
    setError(null)
    setEditing(true)
  }

  function stopEditing() {
    setEditing(false)
    setError(null)
  }

  if (editing) {
    return (
      <li className={`${tileClass} border-[var(--wa-interactive)]`}>
        <TileIcon />
        <TextInput
          aria-label={t('buildings.name')}
          autoFocus
          className="min-w-0 flex-1"
          error={error}
          placeholder={t('buildings.namePlaceholder')}
          size="xs"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) {
              event.preventDefault()
              save.mutate()
            }
            if (event.key === 'Escape') stopEditing()
          }}
        />
        <ActionIcon aria-label={t('actions.cancel')} size={28} variant="subtle" onClick={stopEditing}>
          <CloseCircleIcon size={16} />
        </ActionIcon>
        <ActionIcon aria-label={t('actions.save')} color="accent" disabled={!name.trim()} loading={save.isPending} size={28} variant="subtle" onClick={() => save.mutate()}>
          <CheckCircleIcon size={16} />
        </ActionIcon>
      </li>
    )
  }

  return (
    <li className={`${tileClass}${readOnly ? ' pr-3' : ''}`}>
      <TileIcon />
      {readOnly ? (
        <Text className="min-w-0 flex-1 truncate" fw={600} size="sm">
          {label}
        </Text>
      ) : (
        <button
          className="m-0 min-w-0 flex-1 cursor-text truncate border-0 border-b border-dashed border-[var(--mantine-color-default-border)] bg-transparent p-0 py-0.5 text-left text-sm font-semibold text-[var(--mantine-color-text)]"
          type="button"
          onClick={startEditing}
        >
          {label}
        </button>
      )}
      <Text c="dimmed" className="whitespace-nowrap" size="sm">
        {building.units_count === 0 ? t('buildings.noUnits') : t('buildings.unitsCount', { count: building.units_count })}
      </Text>
      {!readOnly ? (
        <>
          <span aria-hidden className="h-5 w-px shrink-0 bg-[var(--mantine-color-default-border)]" />
          <ActionIcon aria-label={t('buildings.rename', { name: label })} size={28} variant="subtle" onClick={startEditing}>
            <PenIcon size={15} />
          </ActionIcon>
          <Tooltip disabled={canDelete} label={deleteHint ?? ''}>
            <span className="inline-flex">
              <ActionIcon aria-label={t('buildings.delete', { name: label })} color="error" disabled={!canDelete} size={28} variant="subtle" onClick={onDelete}>
                <TrashBinTrashIcon size={15} />
              </ActionIcon>
            </span>
          </Tooltip>
        </>
      ) : null}
    </li>
  )
}

/** The add row lives in the grid as one more tile: input, cancel, confirm. */
function AddTowerTile({ locationId, onCancel, onSaved }: { locationId: string; onCancel: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation('common')
  const [name, setName] = useState('')

  const create = useMutation({
    mutationFn: () => createBuilding(locationId, { name: name.trim() }),
    onSuccess: async () => {
      await onSaved()
      notifySuccess(t('buildings.added'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  return (
    <li className={`${tileClass} border-[var(--wa-interactive)]`}>
      <form
        className="flex min-w-0 flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) create.mutate()
        }}
      >
        <TileIcon />
        <TextInput
          aria-label={t('buildings.name')}
          autoFocus
          className="min-w-0 flex-1"
          placeholder={t('buildings.namePlaceholder')}
          size="xs"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel()
          }}
        />
        <Button size="xs" variant="subtle" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        <Button color="accent" disabled={!name.trim()} loading={create.isPending} size="xs" type="submit">
          {t('buildings.addShort')}
        </Button>
      </form>
    </li>
  )
}
