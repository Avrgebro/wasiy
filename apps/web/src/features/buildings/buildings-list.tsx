import { ActionIcon, Button, Loader, Text, TextInput, Tooltip } from '@mantine/core'
import { AddIcon, TrashBinTrashIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { buildingsQueryKey, createBuilding, deleteBuilding, getBuildings, updateBuilding, type BuildingSummary } from './api'

/**
 * The location's towers as an editable list (ADR 0037): rename in place,
 * a short code for chips, the unit count per tower, and a delete that is
 * disabled while units live there or while it is the only one. A TagsInput
 * could add and remove but never rename, which is why this is a list.
 */
export function BuildingsList({ locationId, readOnly = false }: { locationId: string; readOnly?: boolean }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
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

  if (query.isLoading) {
    return (
      <div className="grid min-h-24 place-items-center">
        <Loader aria-label={t('common.loading')} />
      </div>
    )
  }

  const single = buildings.length === 1

  return (
    <div className="flex flex-col gap-3">
      <Text c="dimmed" size="sm">
        {t(single ? 'buildings.singleHint' : 'buildings.multiHint')}
      </Text>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {buildings.map((building) => (
          <BuildingRow
            key={building.id}
            building={building}
            canDelete={!readOnly && !single && building.units_count === 0}
            deleteHint={single ? t('buildings.lastOne') : building.units_count > 0 ? t('buildings.inUse', { count: building.units_count }) : undefined}
            nameRequired={!single}
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

      <ConfirmDialog
        body={t('buildings.confirmDeleteBody')}
        opened={deleting !== null}
        title={t('buildings.confirmDeleteTitle', { name: deleting?.name ?? '' })}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  )
}

function BuildingRow({
  building,
  canDelete,
  deleteHint,
  nameRequired,
  onDelete,
  onSaved,
  readOnly,
}: {
  building: BuildingSummary
  canDelete: boolean
  deleteHint?: string
  nameRequired: boolean
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
    mutationFn: () => updateBuilding(building.id, { name: name.trim() || null, code: code.trim() || null }),
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
        required={nameRequired}
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
          <Button disabled={!dirty || (nameRequired && !name.trim())} loading={save.isPending} variant="default" onClick={() => save.mutate()}>
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
