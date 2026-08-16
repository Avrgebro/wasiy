import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, TextInput } from '@mantine/core'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import { ImportRegistryButton } from '../imports/import-registry-button'
import { NullableTextInput } from '../registry/nullable-text-input'
import { RegistryCrudPage } from '../registry/registry-crud-page'
import { statusOptions } from '../registry/status-options'
import { normalizedRegistrySearch } from '../registry/types'
import { createUnit, getUnits, updateUnit, type UnitSummary } from './api'
import { unitSchema, type UnitFormValues } from './schemas'
import { formatUnitLabel } from './unit-label'
import { fieldErrorMessage } from '../../lib/errors'

const routeApi = getRouteApi('/_authenticated/admin/registry/units')

function unitDefaults(unit?: UnitSummary): UnitFormValues {
  return {
    building_name: unit?.building_name ?? null,
    floor: unit?.floor ?? null,
    notes: unit?.notes ?? null,
    status: unit?.status ?? 'active',
    unit_number: unit?.unit_number ?? '',
  }
}

export function UnitsRegistryPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null

  if (!location) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <UnitsRegistryContent location={location} />
}

function UnitsRegistryContent({ location }: { location: { id: string } }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = normalizedRegistrySearch(routeApi.useSearch())

  function updateSearch(next: Partial<typeof search>) {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  const columns = (openEdit: (unit: UnitSummary) => void): ColumnDef<UnitSummary>[] => [
    {
      accessorKey: 'unit_number',
      header: t('registry.units.unit'),
      cell: ({ row }) => formatUnitLabel(row.original),
    },
    { accessorKey: 'floor', header: t('registry.units.floor') },
    { accessorKey: 'status', header: t('registry.status') },
    { accessorKey: 'resident_count', header: t('registry.units.residents') },
    {
      accessorKey: 'primary_contact',
      header: t('registry.units.primaryContact'),
      cell: ({ row }) => row.original.primary_contact?.name ?? '-',
    },
    { accessorKey: 'vehicle_count', header: t('registry.units.vehicles') },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="xs" variant="subtle" onClick={() => openEdit(row.original)}>
          {t('actions.edit')}
        </Button>
      ),
    },
  ]

  return (
    <RegistryCrudPage<UnitSummary, UnitFormValues>
      columns={columns}
      title={t('registry.units.title')}
      newLabel={t('registry.units.new')}
      editLabel={t('registry.units.edit')}
      headerExtra={<ImportRegistryButton />}
      search={search}
      onSearchChange={updateSearch}
      queryKey={['registry', 'units', location.id, search]}
      invalidateKey={['registry', 'units']}
      fetchPage={() => getUnits(location.id, search)}
      create={(values) => createUnit(location.id, values)}
      update={(unit, values) => updateUnit(unit.id, values)}
      resolver={zodResolver(unitSchema)}
      defaults={unitDefaults}
      manualSorting
      renderFormFields={(form) => (
        <>
          <Controller
            control={form.control}
            name="unit_number"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                error={fieldErrorMessage(fieldState.error)}
                label={t('registry.units.unit')}
              />
            )}
          />
          <NullableTextInput
            control={form.control}
            label={t('registry.units.building')}
            name="building_name"
          />
          <NullableTextInput
            control={form.control}
            label={t('registry.units.floor')}
            name="floor"
          />
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select {...field} data={statusOptions(t)} label={t('registry.status')} />
            )}
          />
          <NullableTextInput
            control={form.control}
            label={t('registry.notes')}
            name="notes"
          />
        </>
      )}
    />
  )
}
