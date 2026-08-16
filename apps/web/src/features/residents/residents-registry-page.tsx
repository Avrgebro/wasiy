import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Select, TextInput } from '@mantine/core'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getDefaultLocation } from '../auth/access'
import { useMe } from '../auth/hooks'
import { ImportRegistryButton } from '../imports/import-registry-button'
import { RegistryCrudPage } from '../registry/registry-crud-page'
import { statusOptions } from '../registry/status-options'
import { useActiveUnitOptions } from '../units/use-active-unit-options'
import { createResident, getResidents, updateResident, type ResidentSummary } from './api'
import { residentSchema, type ResidentFormValues } from './schemas'
import { fieldErrorMessage } from '../../lib/errors'

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

function residentTypeOptions(t: (key: string) => string) {
  return [
    { label: t('portal.residentTypes.owner'), value: 'owner' },
    { label: t('portal.residentTypes.tenant'), value: 'tenant' },
    { label: t('portal.residentTypes.occupant'), value: 'occupant' },
    { label: t('portal.residentTypes.guestResident'), value: 'guest_resident' },
  ]
}

export function ResidentsRegistryPage() {
  const { t } = useTranslation('common')
  const meQuery = useMe()
  const account = meQuery.data?.active_account
  const location = meQuery.data ? getDefaultLocation(meQuery.data) : null

  if (!account) {
    return (
      <Alert color="yellow" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return <ResidentsRegistryContent account={account} location={location} />
}

function ResidentsRegistryContent({
  account,
  location,
}: {
  account: { id: string }
  location: { id: string } | null
}) {
  const { t } = useTranslation('common')
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()
  const unitOptions = useActiveUnitOptions(location)

  function updateSearch(next: Partial<typeof search>) {
    void navigate({
      search: (current) => ({
        ...current,
        ...next,
        page: next.page ?? 1,
      }),
    })
  }

  const columns = (openEdit: (resident: ResidentSummary) => void): ColumnDef<ResidentSummary>[] => [
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

  return (
    <RegistryCrudPage<ResidentSummary, ResidentFormValues>
      columns={columns}
      title={t('registry.residents.title')}
      newLabel={t('registry.residents.new')}
      editLabel={t('registry.residents.edit')}
      headerExtra={<ImportRegistryButton />}
      search={search}
      onSearchChange={updateSearch}
      queryKey={['registry', 'residents', account.id, location?.id, search]}
      invalidateKey={['registry', 'residents']}
      fetchPage={() => getResidents(account.id, { ...search, location_id: location?.id })}
      create={(values) => createResident(account.id, values)}
      update={(resident, values) => updateResident(resident.id, values)}
      resolver={zodResolver(residentSchema)}
      defaults={residentDefaults}
      renderFormFields={(form, editingResident) => (
        <>
          <Controller
            control={form.control}
            name="first_name"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.residents.firstName')} />
            )}
          />
          <Controller
            control={form.control}
            name="last_name"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.residents.lastName')} />
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('registry.residents.phone')} />
            )}
          />
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldErrorMessage(fieldState.error)} label={t('auth.email')} />
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
                    data={unitOptions}
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
                    data={residentTypeOptions(t)}
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
              <Select {...field} data={statusOptions(t)} label={t('registry.status')} />
            )}
          />
        </>
      )}
    />
  )
}
