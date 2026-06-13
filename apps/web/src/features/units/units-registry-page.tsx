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
import { createUnit, getUnits, updateUnit, type UnitSummary } from './api'
import { unitSchema, type UnitFormValues } from './schemas'
import {
  applyLaravelValidationErrors,
  getErrorMessage,
} from '../../lib/errors'

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
  const queryClient = useQueryClient()
  const navigate = routeApi.useNavigate()
  const routeSearch = routeApi.useSearch()
  const search = normalizedRegistrySearch(routeSearch)
  const meQuery = useMe()
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const [editingUnit, setEditingUnit] = useState<UnitSummary | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)
  const queryKey = ['registry', 'units', location?.id, search] as const
  const unitsQuery = useQuery({
    enabled: Boolean(location),
    queryKey,
    queryFn: () => getUnits(location?.id ?? '', search),
  })
  const form = useForm<UnitFormValues>({
    defaultValues: unitDefaults(),
    resolver: zodResolver(unitSchema),
  })
  const mutation = useMutation({
    mutationFn: (values: UnitFormValues) =>
      editingUnit
        ? updateUnit(editingUnit.id, values)
        : createUnit(location?.id ?? '', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'units'] })
      setDrawerOpened(false)
      showNotification({
        color: 'green',
        message: t('registry.saved'),
        title: t('registry.savedTitle'),
      })
    },
  })
  const columns: ColumnDef<UnitSummary>[] = [
    {
      accessorKey: 'unit_number',
      header: t('registry.units.unit'),
      cell: ({ row }) => {
        const unit = row.original

        return [unit.building_name, unit.unit_number].filter(Boolean).join(' / ')
      },
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
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: unitsQuery.data?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
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
    setEditingUnit(null)
    form.reset(unitDefaults())
    setDrawerOpened(true)
  }

  function openEdit(unit: UnitSummary) {
    setEditingUnit(unit)
    form.reset(unitDefaults(unit))
    setDrawerOpened(true)
  }

  async function handleSubmit(values: UnitFormValues) {
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      if (!applyLaravelValidationErrors<UnitFormValues>(error, form.setError)) {
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
      <RegistryHeader
        actionLabel={t('registry.units.new')}
        onAction={openCreate}
        title={t('registry.units.title')}
      />
      <RegistryFilters
        onSearch={(value) => updateSearch({ search: value })}
        onStatus={(value) => updateSearch({ status: value ?? '' })}
        search={search.search}
        status={search.status}
      />
      {unitsQuery.isError ? (
        <Alert color="red" title={t('errors.loadFailed')}>
          {getErrorMessage(unitsQuery.error)}
        </Alert>
      ) : null}
      {unitsQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : (
        <RegistryTable table={table} />
      )}
      <Pagination
        onChange={(page) => updateSearch({ page })}
        total={unitsQuery.data?.meta.last_page ?? 1}
        value={search.page}
      />
      <Drawer
        opened={drawerOpened}
        position="right"
        title={editingUnit ? t('registry.units.edit') : t('registry.units.new')}
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
            name="unit_number"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                error={fieldState.error?.message}
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
          <NullableTextInput
            control={form.control}
            label={t('registry.notes')}
            name="notes"
          />
          <Button loading={mutation.isPending} type="submit">
            {t('actions.save')}
          </Button>
        </form>
      </Drawer>
    </div>
  )
}

function RegistryHeader({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel: string
  onAction: () => void
  title: string
}) {
  return (
    <Group justify="space-between">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      <Button leftSection={<AddCircle size={16} />} onClick={onAction}>
        {actionLabel}
      </Button>
    </Group>
  )
}

function RegistryFilters({
  onSearch,
  onStatus,
  search,
  status,
}: {
  onSearch: (value: string) => void
  onStatus: (value: string | null) => void
  search: string
  status: string
}) {
  const { t } = useTranslation('common')

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
      <TextInput
        defaultValue={search}
        label={t('actions.search')}
        onBlur={(event) => onSearch(event.currentTarget.value)}
      />
      <Select
        clearable
        data={[
          { label: t('registry.statuses.active'), value: 'active' },
          { label: t('registry.statuses.inactive'), value: 'inactive' },
        ]}
        label={t('registry.status')}
        value={status || null}
        onChange={onStatus}
      />
    </div>
  )
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
  control: ReturnType<typeof useForm<UnitFormValues>>['control']
  label: string
  name: 'building_name' | 'floor' | 'notes'
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
