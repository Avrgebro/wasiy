import { apiRequest } from '../../app/api-client'
import {
  appendRegistryParams,
  type PaginatedApiResponse,
  type RegistrySearch,
} from '../registry/types'
import type { VehicleFormValues } from './schemas'

export type VehicleSummary = {
  id: string
  account_id: string
  location_id: string
  unit_id: string
  vehicle_type: 'car' | 'motorcycle' | 'bicycle' | 'other'
  plate: string | null
  make: string | null
  model: string | null
  color: string | null
  status: 'active' | 'inactive'
  notes: string | null
  unit?: {
    id: string
    unit_number: string
    building_name: string | null
    floor: string | null
  }
}

export function getVehicles(locationId: string, search: RegistrySearch & { vehicle_type?: string }) {
  const params = new URLSearchParams()
  appendRegistryParams(params, search)
  if (search.vehicle_type) params.set('vehicle_type', search.vehicle_type)

  return apiRequest<PaginatedApiResponse<VehicleSummary>>(
    `/api/locations/${locationId}/vehicles?${params.toString()}`,
  )
}

export function createVehicle(locationId: string, values: VehicleFormValues) {
  return apiRequest<{ data: VehicleSummary }>(
    `/api/locations/${locationId}/vehicles`,
    {
      data: values,
      method: 'POST',
    },
  )
}

export function updateVehicle(vehicleId: string, values: VehicleFormValues) {
  return apiRequest<{ data: VehicleSummary }>(`/api/vehicles/${vehicleId}`, {
    data: values,
    method: 'PATCH',
  })
}
