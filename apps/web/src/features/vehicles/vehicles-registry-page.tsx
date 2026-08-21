import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select } from '@mantine/core'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import { NullableTextInput } from '../registry/nullable-text-input'
import { RegistryCrudPage } from '../registry/registry-crud-page'
import { statusOptions } from '../registry/status-options'
import { formatUnitLabel } from '../units/unit-label'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { createVehicle, getVehicles, updateVehicle, type VehicleSummary } from './api'
import { vehicleSchema, type VehicleFormValues } from './schemas'
import { fieldErrorMessage } from '../../lib/errors'

const routeApi = getRouteApi('/_authenticated/admin/registry/vehicles')

function vehicleDefaults(vehicle?: VehicleSummary): VehicleFormValues {
  return {
    color: vehicle?.color ?? null,
    make: vehicle?.make ?? null,
    model: vehicle?.model ?? null,
    notes: vehicle?.notes ?? null,
    plate: vehicle?.plate ?? null,
    status: vehicle?.status ?? 'active',
    unit_id: vehicle?.unit_id ?? '',
    vehicle_type: vehicle?.vehicle_type ?? 'car',
  }
}

function vehicleTypeOptions(t: (key: string) => string) {
  return [
    { label: t('registry.vehicleTypes.car'), value: 'car' },
    { label: t('registry.vehicleTypes.motorcycle'), value: 'motorcycle' },
    { label: t('registry.vehicleTypes.bicycle'), value: 'bicycle' },
    { label: t('registry.vehicleTypes.other'), value: 'other' },
  ]
}

export function VehiclesRegistryPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null

  if (!location) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return <VehiclesRegistryContent location={location} />
}

function VehiclesRegistryContent({ location }: { location: { id: string } }) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const vehicleType = search.vehicle_type
  const unitOptions = useActiveUnitOptions(location)

  function updateSearch(next: Partial<typeof search> & { vehicle_type?: string }) {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  const columns = (openEdit: (vehicle: VehicleSummary) => void): ColumnDef<VehicleSummary>[] => [
    { accessorKey: 'plate', header: t('registry.vehicles.plate') },
    {
      accessorKey: 'vehicle_type',
      header: t('registry.vehicles.type'),
      cell: ({ row }) => t(`registry.vehicleTypes.${row.original.vehicle_type}`),
    },
    {
      accessorKey: 'unit_id',
      header: t('registry.vehicles.unit'),
      cell: ({ row }) =>
        row.original.unit ? formatUnitLabel(row.original.unit) : row.original.unit_id,
    },
    { accessorKey: 'color', header: t('registry.vehicles.color') },
    { accessorKey: 'make', header: t('registry.vehicles.make') },
    { accessorKey: 'status', header: t('registry.status') },
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
    <RegistryCrudPage<VehicleSummary, VehicleFormValues>
      columns={columns}
      title={t('registry.vehicles.title')}
      newLabel={t('registry.vehicles.new')}
      editLabel={t('registry.vehicles.edit')}
      extraFilters={
        <Select
          clearable
          data={vehicleTypeOptions(t)}
          label={t('registry.vehicles.type')}
          value={vehicleType || null}
          onChange={(value) => updateSearch({ vehicle_type: value ?? '' })}
        />
      }
      search={search}
      onSearchChange={updateSearch}
      queryKey={['registry', 'vehicles', location.id, search, vehicleType]}
      invalidateKey={['registry', 'vehicles']}
      fetchPage={() => getVehicles(location.id, { ...search, vehicle_type: vehicleType })}
      create={(values) => createVehicle(location.id, values)}
      update={(vehicle, values) => updateVehicle(vehicle.id, values)}
      resolver={zodResolver(vehicleSchema)}
      defaults={vehicleDefaults}
      renderFormFields={(form) => (
        <>
          <Controller
            control={form.control}
            name="unit_id"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={unitOptions}
                error={fieldErrorMessage(fieldState.error)}
                label={t('registry.vehicles.unit')}
              />
            )}
          />
          <Controller
            control={form.control}
            name="vehicle_type"
            render={({ field }) => (
              <Select {...field} data={vehicleTypeOptions(t)} label={t('registry.vehicles.type')} />
            )}
          />
          {(['plate', 'make', 'model', 'color', 'notes'] as const).map((name) => (
            <NullableTextInput
              control={form.control}
              key={name}
              label={t(`registry.vehicles.${name}`)}
              name={name}
            />
          ))}
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select {...field} data={statusOptions(t)} label={t('registry.status')} />
            )}
          />
        </>
      )}
    />
  )
}
