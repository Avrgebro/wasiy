import { Select, TextInput } from '@mantine/core'
import { Magnifier } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import { accountRoles, getRoleLabelKey, locationRoles } from '../auth/access'
import type { StaffSearchValues } from './schemas'

export type LocationOption = { value: string; label: string }

function roleFilterOptions(t: (key: string) => string) {
  return [
    { label: t(getRoleLabelKey(accountRoles.accountAdmin)), value: accountRoles.accountAdmin },
    {
      label: t(getRoleLabelKey(locationRoles.locationManager)),
      value: locationRoles.locationManager,
    },
    { label: t(getRoleLabelKey(locationRoles.frontDesk)), value: locationRoles.frontDesk },
  ]
}

/** The card-header toolbar: free-text search plus the two server filters. */
export function StaffFilters({
  locations,
  onChange,
  search,
}: {
  locations: LocationOption[]
  onChange: (next: Partial<StaffSearchValues>) => void
  search: StaffSearchValues
}) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col flex-wrap gap-2.5 p-3.5 sm:flex-row sm:items-center sm:px-5">
      <TextInput
        aria-label={t('actions.search')}
        className="sm:w-64 lg:w-80"
        defaultValue={search.search}
        leftSection={<Magnifier size={15} />}
        placeholder={t('staff.searchPlaceholder')}
        onBlur={(event) => onChange({ search: event.currentTarget.value })}
      />
      <Select
        aria-label={t('staff.role')}
        className="sm:w-44"
        clearable
        data={roleFilterOptions(t)}
        placeholder={t('staff.allRoles')}
        value={search.role || null}
        onChange={(value) => onChange({ role: value ?? '' })}
      />
      <Select
        aria-label={t('staff.location')}
        className="sm:w-52"
        clearable
        data={locations}
        placeholder={t('staff.allLocations')}
        value={search.location_id || null}
        onChange={(value) => onChange({ location_id: value ?? '' })}
      />
    </div>
  )
}
