import { Alert, Button, Drawer, Loader, Pagination } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { useState, type ReactNode } from 'react'
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getErrorMessage, submitHandlingServerErrors } from '../../lib/errors'
import { RegistryFilters, RegistryHeader } from './registry-page-chrome'
import { RegistryTable } from './registry-table'
import type { RegistrySearchValues } from './search'
import type { PaginatedApiResponse } from './types'

export type { RegistrySearchValues }

type RegistryCrudPageProps<TRow extends { id: string }, TForm extends FieldValues> = {
  columns: (openEdit: (row: TRow) => void) => ColumnDef<TRow>[]
  title: string
  newLabel: string
  editLabel: string
  headerExtra?: ReactNode
  extraFilters?: ReactNode
  search: RegistrySearchValues
  onSearchChange: (next: { page?: number; search?: string; status?: string }) => void
  queryKey: QueryKey
  invalidateKey: QueryKey
  fetchPage: () => Promise<PaginatedApiResponse<TRow>>
  create: (values: TForm) => Promise<unknown>
  update: (row: TRow, values: TForm) => Promise<unknown>
  resolver: Resolver<TForm>
  defaults: (row?: TRow) => TForm
  manualSorting?: boolean
  renderFormFields: (form: UseFormReturn<TForm>, editing: TRow | null) => ReactNode
}

/**
 * Shared skeleton for the registry CRUD pages: paginated table with
 * search/status filters and a create-or-edit drawer form. Pages provide the
 * entity-specific columns, form fields, and API calls.
 */
export function RegistryCrudPage<TRow extends { id: string }, TForm extends FieldValues>({
  columns,
  title,
  newLabel,
  editLabel,
  headerExtra,
  extraFilters,
  search,
  onSearchChange,
  queryKey,
  invalidateKey,
  fetchPage,
  create,
  update,
  resolver,
  defaults,
  manualSorting = false,
  renderFormFields,
}: RegistryCrudPageProps<TRow, TForm>) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<TRow | null>(null)
  const [drawerOpened, setDrawerOpened] = useState(false)
  const listQuery = useQuery({ queryKey, queryFn: fetchPage })
  const form = useForm<TForm>({
    defaultValues: defaults() as DefaultValues<TForm>,
    resolver,
  })
  const mutation = useMutation({
    mutationFn: (values: TForm) => (editing ? update(editing, values) : create(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invalidateKey })
      setDrawerOpened(false)
      showNotification({
        color: 'green',
        message: t('registry.saved'),
        title: t('registry.savedTitle'),
      })
    },
  })
  function openCreate() {
    setEditing(null)
    form.reset(defaults())
    setDrawerOpened(true)
  }

  function openEdit(row: TRow) {
    setEditing(row)
    form.reset(defaults(row))
    setDrawerOpened(true)
  }

  async function handleSubmit(values: TForm) {
    await submitHandlingServerErrors(form, () => mutation.mutateAsync(values))
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns: columns(openEdit),
    data: listQuery.data?.data ?? [],
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting,
  })

  return (
    <div className="flex flex-col gap-5">
        <RegistryHeader actionLabel={newLabel} extra={headerExtra} onAction={openCreate} title={title} />
        <RegistryFilters
          extraFilters={extraFilters}
          onSearch={(value) => onSearchChange({ search: value })}
          onStatus={(value) => onSearchChange({ status: value ?? '' })}
          search={search.search}
          status={search.status}
        />
        {listQuery.isError ? (
          <Alert color="error" title={t('errors.loadFailed')}>
            {getErrorMessage(listQuery.error)}
          </Alert>
        ) : null}
        {listQuery.isLoading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader aria-label={t('common.loading')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <RegistryTable table={table} />
          </div>
        )}
        <Pagination
          onChange={(page) => onSearchChange({ page })}
          total={listQuery.data?.meta.last_page ?? 1}
          value={search.page}
        />
        <Drawer
          opened={drawerOpened}
          position="right"
          title={editing ? editLabel : newLabel}
          onClose={() => setDrawerOpened(false)}
        >
          <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
            {form.formState.errors.root?.message ? (
              <Alert color="error" title={t('errors.actionFailed')}>
                {form.formState.errors.root.message}
              </Alert>
            ) : null}
            {renderFormFields(form, editing)}
            <Button loading={mutation.isPending} type="submit">
              {t('actions.save')}
            </Button>
          </form>
      </Drawer>
    </div>
  )
}
