import { ActionIcon, Alert, Button, Loader, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { AddIcon, TrashBinTrashIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { buildingsQueryKey, createBuilding, deleteBuilding, getBuildings, updateBuilding, type BuildingSummary } from './api'

/**
 * The location's towers (ADR 0037). Every location owns one building row
 * from birth, but a single-tower location must not look like a half-filled
 * form, so the default row stays hidden behind a switch: off = one tower,
 * units show no tower. Turning it on names the existing tower and creates
 * the second in one save (existing units stay in the first). With two or
 * more towers the switch stays on and the editable list appears: rename in
 * place, a short code for chips, unit counts, add, delete when empty.
 * Turning it back off deletes the empty extra towers and clears the first
 * tower's name — only possible while those towers hold no units.
 */
export function BuildingsList({ locationId, readOnly = false }: { locationId: string; readOnly?: boolean }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<BuildingSummary | null>(null)

  const query = useQuery({ queryKey: buildingsQueryKey(locationId), queryFn: () => getBuildings(locationId) })
  const buildings = query.data?.data ?? []

  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: buildingsQueryKey(locationId) }),
      queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
    ])
  }

  const create = useMutation({
    mutationFn: (name: string) => createBuilding(locationId, { name }),
    onSuccess: async () => {
      await refresh()
      setAdding(false)
      setNewName('')
      notifySuccess(t('buildings.added'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })
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
      <div className="grid min-h-24 place-items-center">
        <Loader aria-label={t('common.loading')} />
      </div>
    )
  }

  const single = buildings.length === 1
  const unitsInOthers = buildings.slice(1).reduce((sum, building) => sum + building.units_count, 0)
  const canCollapse = !single && unitsInOthers === 0
  const multi = !single || enabling

  return (
    <div className="flex flex-col gap-4">
      <Tooltip disabled={single || canCollapse} label={t('buildings.collapseBlocked', { count: unitsInOthers })}>
        <div className="self-start">
          <Switch
            checked={multi}
            description={t(multi ? 'buildings.multiHint' : 'buildings.singleHint')}
            disabled={readOnly || (!single && !canCollapse)}
            label={t('buildings.toggle')}
            onChange={(event) => {
              if (event.currentTarget.checked) setEnabling(true)
              else if (single) setEnabling(false)
              else setDisabling(true)
            }}
          />
        </div>
      </Tooltip>

      {single && enabling ? (
        <EnableTowersForm
          first={buildings[0]}
          onCancel={() => setEnabling(false)}
          onSaved={async () => {
            await refresh()
            setEnabling(false)
          }}
        />
      ) : null}

      {!single ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {buildings.map((building) => (
              <BuildingRow
                key={building.id}
                building={building}
                canDelete={!readOnly && building.units_count === 0}
                deleteHint={building.units_count > 0 ? t('buildings.inUse', { count: building.units_count }) : undefined}
                readOnly={readOnly}
                onDelete={() => setDeleting(building)}
                onSaved={refresh}
              />
            ))}
          </ul>

          {!readOnly ? (
            adding ? (
              <form
                className="flex flex-wrap items-end gap-2 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (newName.trim()) create.mutate(newName.trim())
                }}
              >
                <TextInput
                  autoFocus
                  className="min-w-48 flex-1"
                  label={t('buildings.name')}
                  placeholder={t('buildings.namePlaceholder')}
                  value={newName}
                  onChange={(event) => setNewName(event.currentTarget.value)}
                />
                <Button variant="default" onClick={() => setAdding(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button color="accent" disabled={!newName.trim()} loading={create.isPending} type="submit">
                  {t('buildings.add')}
                </Button>
              </form>
            ) : (
              <Button className="self-start" leftSection={<AddIcon size={18} />} variant="default" onClick={() => setAdding(true)}>
                {t('buildings.add')}
              </Button>
            )
          ) : null}
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
    </div>
  )
}

/**
 * First-time split: name the existing tower and the new one, then one save
 * renames the first (its units come along by reference) and creates the
 * second. Codes are left for the list afterwards so this asks for names only.
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
      className="flex flex-col gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) save.mutate()
      }}
    >
      <Alert color="warning" variant="light">
        {t('buildings.enableNotice', { count: first.units_count })}
      </Alert>
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
        placeholder={t('buildings.namePlaceholder')}
        required
        value={secondName}
        onChange={(event) => setSecondName(event.currentTarget.value)}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="default" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
        <Button color="accent" disabled={!ready} loading={save.isPending} type="submit">
          {t('actions.save')}
        </Button>
      </div>
    </form>
  )
}

function BuildingRow({
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
  const [name, setName] = useState(building.name ?? '')
  const [code, setCode] = useState(building.code ?? '')
  const [error, setError] = useState<string | null>(null)
  const dirty = name !== (building.name ?? '') || code !== (building.code ?? '')

  const save = useMutation({
    mutationFn: () => updateBuilding(building.id, { name: name.trim(), code: code.trim() || null }),
    onSuccess: async () => {
      setError(null)
      await onSaved()
      notifySuccess(t('buildings.saved'))
    },
    onError: (err) => setError(getErrorMessage(err)),
  })

  return (
    <li className="flex flex-wrap items-end gap-2 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] p-3">
      <TextInput
        className="min-w-40 flex-1"
        error={error}
        label={t('buildings.name')}
        placeholder={t('buildings.unnamed')}
        readOnly={readOnly}
        required
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <TextInput
        className="w-24"
        label={t('buildings.code')}
        maxLength={8}
        placeholder="T1"
        readOnly={readOnly}
        value={code}
        onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
      />
      <Text c="dimmed" className="min-w-24 pb-2" size="sm">
        {t('buildings.unitsCount', { count: building.units_count })}
      </Text>
      {!readOnly ? (
        <>
          <Button disabled={!dirty || !name.trim()} loading={save.isPending} variant="default" onClick={() => save.mutate()}>
            {t('actions.save')}
          </Button>
          <Tooltip disabled={canDelete} label={deleteHint ?? ''}>
            <span>
              <ActionIcon aria-label={t('buildings.delete', { name: building.name ?? t('buildings.unnamed') })} color="error" disabled={!canDelete} size={36} variant="subtle" onClick={onDelete}>
                <TrashBinTrashIcon size={18} />
              </ActionIcon>
            </span>
          </Tooltip>
        </>
      ) : null}
    </li>
  )
}
