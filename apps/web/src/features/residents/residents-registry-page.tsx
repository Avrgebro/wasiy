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
import { createResident, getResidents, updateResident, type ResidentSummary } from './api'
import { residentSchema, type ResidentFormValues } from './schemas'
import {
  applyLaravelValidationErrors,
  getErrorMessage,
} from '../../lib/errors'

const routeApi = getRouteApi('/_authenticated/admin/registry/residents')

function residentDefaults(resident?: ResidentSummary): ResidentFormValues {
  return {
    email: resident?.email ?? '',
    first_name: resident?.first_name ?? '',
    last_name: resident?.last_name ?? '',
    phone: resident?.phone ?? '',
    resident_type: 'tenant',
    status: resident?.status ?? 'active',
    unit_id: '',
  }
}

export function ResidentsRegistryPage() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const navigate = routeApi.useNavigate()
  const routeSearch = routeApi.useSearch()
  const search = normalizedRegistrySearch(routeSearch)
  const meQuery = useMe()
  const account = meQuery.data?.active_account
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null
  const [editingResident, setEditingResident] = useState<ResidentSummary | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)
  const residentsQuery = useQuery({
    enabled: Boolean(account),
    queryKey: ['registry', 'residents', account?.id, location?.id, search],
    queryFn: () =>
      getResidents(account?.id ?? '', {
        ...search,
        location_id: location?.id,
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
  const form = useForm<ResidentFormValues>({
    defaultValues: residentDefaults(),
    resolver: zodResolver(residentSchema),
  })
  const mutation = useMutation({
    mutationFn: (values: ResidentFormValues) =>
      editingResident
        ? updateResident(editingResident.id, values)
        : createResident(account?.id ?? '', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['registry', 'residents'] })
      setDrawerOpened(false)
      showNotification({
        color: 'green',
        message: t('registry.saved'),
        title: t('registry.savedTitle'),
      })
    },
  })
  const columns: ColumnDef<ResidentSummary>[] = [
    { accessorKey: 'name', header: t('registry.residents.name') },
    { accessorKey: 'phone', header: t('registry.residents.phone') },
    {
      accessorKey: 'user_id',
      header: t('registry.residents.portal'),
      cell: ({ row }) =>
        row.original.user_id ? t('registry.portal.enabled') : t('registry.portal.disabled'),
    },
    {
      accessorKey: 'memberships',
      header: t('registry.residents.memberships'),
      cell: ({ row }) => row.original.memberships.length,
    },
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
    data: residentsQuery.data?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
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
    setEditingResident(null)
    form.reset(residentDefaults())
    setDrawerOpened(true)
  }

  function openEdit(resident: ResidentSummary) {
    setEditingResident(resident)
    form.reset(residentDefaults(resident))
    setDrawerOpened(true)
  }

  async function handleSubmit(values: ResidentFormValues) {
    try {
      await mutation.mutateAsync(values)
    } catch (error) {
      if (!applyLaravelValidationErrors<ResidentFormValues>(error, form.setError)) {
        form.setError('root', {
          message: getErrorMessage(error),
          type: 'server',
        })
      }
    }
  }

  if (!account) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Group justify="space-between">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('registry.residents.title')}
        </h1>
        <Button leftSection={<AddCircle size={16} />} onClick={openCreate}>
          {t('registry.residents.new')}
        </Button>
      </Group>
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
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
      </div>
      {residentsQuery.isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <Loader aria-label={t('common.loading')} />
        </div>
      ) : (
        <RegistryTable table={table} />
      )}
      <Pagination
        onChange={(page) => updateSearch({ page })}
        total={residentsQuery.data?.meta.last_page ?? 1}
        value={search.page}
      />
      <Drawer
        opened={drawerOpened}
        position="right"
        title={
          editingResident
            ? t('registry.residents.edit')
            : t('registry.residents.new')
        }
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
            name="first_name"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldState.error?.message} label={t('registry.residents.firstName')} />
            )}
          />
          <Controller
            control={form.control}
            name="last_name"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldState.error?.message} label={t('registry.residents.lastName')} />
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldState.error?.message} label={t('registry.residents.phone')} />
            )}
          />
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldState.error?.message} label={t('auth.email')} />
            )}
          />
          {editingResident ? null : (
            <>
              <Controller
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <Select
                    {...field}
                    clearable
                    data={(unitsQuery.data?.data ?? []).map((unit) => ({
                      label: [unit.building_name, unit.unit_number].filter(Boolean).join(' / '),
                      value: unit.id,
                    }))}
                    label={t('registry.residents.unit')}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="resident_type"
                render={({ field }) => (
                  <Select
                    {...field}
                    data={[
                      { label: t('portal.residentTypes.owner'), value: 'owner' },
                      { label: t('portal.residentTypes.tenant'), value: 'tenant' },
                      { label: t('portal.residentTypes.occupant'), value: 'occupant' },
                      { label: t('portal.residentTypes.guestResident'), value: 'guest_resident' },
                    ]}
                    label={t('registry.residents.type')}
                  />
                )}
              />
            </>
          )}
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
