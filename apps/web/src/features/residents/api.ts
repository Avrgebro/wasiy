import { apiRequest } from '../../app/api-client'
import {
  appendRegistryParams,
  type PaginatedApiResponse,
  type RegistrySearch,
} from '../registry/types'
import type { ResidentFormValues } from './schemas'

export type ResidentSummary = {
  id: string
  account_id: string
  user_id: string | null
  first_name: string
  last_name: string
  name: string
  phone: string | null
  email: string | null
  status: 'active' | 'inactive'
  memberships: Array<{
    id: string
    unit_id: string
    resident_type: string
    status: 'active' | 'inactive'
    unit?: {
      unit_number: string
      building_name: string | null
    }
  }>
}

export function getResidents(accountId: string, search: RegistrySearch & { location_id?: string }) {
  const params = new URLSearchParams()
  appendRegistryParams(params, search)
  if (search.location_id) params.set('location_id', search.location_id)

  return apiRequest<PaginatedApiResponse<ResidentSummary>>(
    `/api/accounts/${accountId}/residents?${params.toString()}`,
  )
}

export function createResident(accountId: string, values: ResidentFormValues) {
  return apiRequest<{ data: ResidentSummary }>(`/api/accounts/${accountId}/residents`, {
    data: {
      email: values.email || null,
      first_name: values.first_name,
      last_name: values.last_name,
      memberships: values.unit_id
        ? [
            {
              resident_type: values.resident_type,
              unit_id: values.unit_id,
            },
          ]
        : [],
      phone: values.phone || null,
    },
    method: 'POST',
  })
}

export function updateResident(residentId: string, values: ResidentFormValues) {
  return apiRequest<{ data: ResidentSummary }>(`/api/residents/${residentId}`, {
    data: {
      email: values.email || null,
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone || null,
      status: values.status,
    },
    method: 'PATCH',
  })
}
