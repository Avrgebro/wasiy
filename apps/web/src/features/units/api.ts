import { apiRequest } from '../../app/api-client'
import {
  appendRegistryParams,
  type PaginatedApiResponse,
  type RegistrySearch,
} from '../registry/types'
import type { UnitFormValues } from './schemas'

export type UnitSummary = {
  id: string
  account_id: string
  location_id: string
  unit_number: string
  building_name: string | null
  floor: string | null
  status: 'active' | 'inactive'
  notes: string | null
  resident_count: number
  vehicle_count: number
  primary_contact: {
    name: string
    phone: string | null
    email: string | null
    resident_type: string
    resident_id: string
    unit_membership_id: string
  } | null
}

export function getUnits(locationId: string, search: RegistrySearch) {
  const params = new URLSearchParams()
  appendRegistryParams(params, search)

  return apiRequest<PaginatedApiResponse<UnitSummary>>(
    `/api/locations/${locationId}/units?${params.toString()}`,
  )
}

export function createUnit(locationId: string, values: UnitFormValues) {
  return apiRequest<{ data: UnitSummary }>(`/api/locations/${locationId}/units`, {
    data: values,
    method: 'POST',
  })
}

export function updateUnit(unitId: string, values: UnitFormValues) {
  return apiRequest<{ data: UnitSummary }>(`/api/units/${unitId}`, {
    data: values,
    method: 'PATCH',
  })
}
