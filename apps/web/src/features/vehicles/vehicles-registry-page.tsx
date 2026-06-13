import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Button,
  Drawer,
  Group,
  Loader,
  Pagination,
  Select,
  Table,
  TextInput,
} from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { AddCircle } from '@solar-icons/react'
import { getRouteApi } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import { normalizedRegistrySearch } from '../registry/types'
import { getUnits } from '../units/api'
import { createVehicle, getVehicles, updateVehicle, type VehicleSummary } from './api'
import { vehicleSchema, type VehicleFormValues } from './schemas'
import {
  applyLaravelValidationErrors,
  getErrorMessage,
} from '../../lib/errors'

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

export function VehiclesRegistryPage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const navigate = routeApi.useNavigate()
  const routeSearch = routeApi.useSearch()
  const search = normalizedRegistrySearch(routeSearch)
  const vehicleType = typeof routeSearch.vehicle_type === 'string' ? routeSearch.vehicle_type : ''
  const meQuery = useMe()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const [editingVehicle, setEditingVehicle] = useState<VehicleSummary | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)
  const vehiclesQuery = useQuery({
    enabled: Boolean(location),
    queryKey: ['registry', 'vehicles', location?.id, search, vehicleType],
    queryFn: () =>
      getVehicles(location?.id ?? '', {
        ...search,
        vehicle_type: vehicleType,
      }),
  })
  const unitsQuery = useQuery({
    enabled: Boolean(location),
    queryKey: ['registry', 'units', location?.id, { per_page: 100, status: 'active' }],
    queryFn: () =>
      getUnits(location?.id ?? '', {
        page: 1,
        per_page: 100,
        status: 'active',
      }),
  })
  const form = useForm<VehicleFormValues>({
    defaultValues: vehicleDefaults(),
    resolver: zodResolver(vehicleSchema),
  })
  const mutation = useMutation({
    mutationFn: (values: VehicleFormValues) =>
      editingVehicle
        ? updateVehicle(editingVehicle.id, values)
        : createVehicle(location?.id ?? '', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'vehicles'] })
      setDrawerOpened(false)
      showNotification({
        color: 'green',
        message: t('registry.saved'),
        title: t('registry.savedTitle'),
      })
    },
  })
  const columns: ColumnDef<VehicleSummary>[] = [
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
        row.original.unit
          ? [row.original.unit.building_name, row.original.unit.unit_number]
              .filter(Boolean)
              .join(' / ')
          : row.original.unit_id,
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
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: vehiclesQuery.data?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  function updateSearch(next: Partial<typeof search> & { vehicle_type?: string }) {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  function openCreate() {
    setEditingVehicle(null)
    form.reset(vehicleDefaults())
    setDrawerOpened(true)
  }

  function openEdit(vehicle: VehicleSummary) {
    setEditingVehicle(vehicle)
    form.reset(vehicleDefaults(vehicle))
    setDrawerOpened(true)
  }

  async function handleSubmit(values: VehicleFormValues) {
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      if (!applyLaravelValidationErrors<VehicleFormValues>(error, form.setError)) {
        form.setError('root', {
          message: getErrorMessage(error),
          type: 'server',
        })
      }
    }
  }

  if (!location) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {t('auth.selectLocationRequired')}
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Group justify="space-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('registry.vehicles.title')}
        </h1>
        <Button leftSection={<AddCircle size={16} />} onClick={openCreate}>
          {t('registry.vehicles.new')}
        </Button>
      </Group>
      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <TextInput
          defaultValue={search.search}
          label={t('actions.search')}
          onBlur={(event) => updateSearch({ search: event.currentTarget.value })}
        />
        <Select
          clearable
          data={[
            { label: t('registry.statuses.active'), value: 'active' },
            { label: t('registry.statuses.inactive'), value: 'inactive' },
          ]}
          label={t('registry.status')}
          value={search.status || null}
          onChange={(value) => updateSearch({ status: value ?? '' })}
        />
        <Select
          clearable
          data={vehicleTypeOptions(t)}
          label={t('registry.vehicles.type')}
          value={vehicleType || null}
          onChange={(value) => updateSearch({ vehicle_type: value ?? '' })}
        />
      </div>
      {vehiclesQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : (
        <RegistryTable table={table} />
      )}
      <Pagination
        onChange={(page) => updateSearch({ page })}
        total={vehiclesQuery.data?.meta.last_page ?? 1}
        value={search.page}
      />
      <Drawer
        opened={drawerOpened}
        position="right"
        title={editingVehicle ? t('registry.vehicles.edit') : t('registry.vehicles.new')}
        onClose={() => setDrawerOpened(false)}
      >
        <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
          {form.formState.errors.root?.message ? (
            <Alert color="red" title={t('errors.actionFailed')}>
              {form.formState.errors.root.message}
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="unit_id"
            render={({ field, fieldState }) => (
              <Select
                {...field}
                data={(unitsQuery.data?.data ?? []).map((unit) => ({
                  label: [unit.building_name, unit.unit_number].filter(Boolean).join(' / '),
                  value: unit.id,
                }))}
                error={fieldState.error?.message}
                label={t('registry.vehicles.unit')}
              />
            )}
          />
          <Controller
            control={form.control}
            name="vehicle_type"
            render={({ field }) => (
              <Select
                {...field}
                data={vehicleTypeOptions(t)}
                label={t('registry.vehicles.type')}
              />
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
              <Select
                {...field}
                data={[
                  { label: t('registry.statuses.active'), value: 'active' },
                  { label: t('registry.statuses.inactive'), value: 'inactive' },
                ]}
                label={t('registry.status')}
              />
            )}
          />
          <Button loading={mutation.isPending} type="submit">
            {t('actions.save')}
          </Button>
        </form>
      </Drawer>
    </div>
  )
}

function vehicleTypeOptions(t: (key: string) => string) {
  return [
    { label: t('registry.vehicleTypes.car'), value: 'car' },
    { label: t('registry.vehicleTypes.motorcycle'), value: 'motorcycle' },
    { label: t('registry.vehicleTypes.bicycle'), value: 'bicycle' },
    { label: t('registry.vehicleTypes.other'), value: 'other' },
  ]
}

function RegistryTable<T>({ table }: { table: ReturnType<typeof useReactTable<T>> }) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.Th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </section>
  )
}

function NullableTextInput({
  control,
  label,
  name,
}: {
  control: ReturnType<typeof useForm<VehicleFormValues>>['control']
  label: string
  name: 'color' | 'make' | 'model' | 'notes' | 'plate'
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextInput
          {...field}
          value={field.value ?? ''}
          error={fieldState.error?.message}
          label={label}
          onChange={(event) => field.onChange(event.currentTarget.value || null)}
        />
      )}
    />
  )
}
