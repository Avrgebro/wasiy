import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type RegistryImportStatus =
  | 'pending'
  | 'processing'
  | 'ready_for_review'
  | 'failed'
  | 'completed'

export type RegistryImportRowStatus =
  | 'valid'
  | 'error'
  | 'duplicate'
  | 'warning'
  | 'imported'
  | 'skipped'

export type RegistryImportType = 'registry_units_residents'

export type RegistryImportSummary = {
  id: string
  account_id: string
  location_id: string
  requested_by_user_id: string
  location?: { name?: string | null } | null
  location_name?: string | null
  import_type: RegistryImportType
  status: RegistryImportStatus
  original_filename: string
  total_rows: number
  valid_rows: number
  error_rows: number
  duplicate_rows: number
  warning_rows: number
  confirmed_at: string | null
  completed_at: string | null
  failed_at: string | null
  failure_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export type RegistryImportRow = {
  id: string
  registry_import_id: string
  account_id: string
  location_id: string
  row_number: number
  status: RegistryImportRowStatus
  raw_data: Record<string, unknown>
  normalized_data: Record<string, unknown>
  errors: string[]
  warnings: string[]
  duplicate_key: string | null
  committed_unit_id: string | null
  committed_resident_id: string | null
  committed_unit_membership_id: string | null
}

export type RegistryImportSearch = {
  account_id: string
  import_type?: RegistryImportType
  location_id?: string
  page?: number
  per_page?: number
  status?: RegistryImportStatus
}

export type RegistryImportRowsSearch = {
  page?: number
  per_page?: number
  search?: string
  status?: RegistryImportRowStatus
}

export function getRegistryImports(search: RegistryImportSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<RegistryImportSummary>>(
    `/api/registry-imports?${params.toString()}`,
  )
}

export function getRegistryImport(importId: string) {
  return apiRequest<{ data: RegistryImportSummary }>(`/api/registry-imports/${importId}`)
}

export function getRegistryImportRows(
  importId: string,
  search: RegistryImportRowsSearch,
) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<RegistryImportRow>>(
    `/api/registry-imports/${importId}/rows?${params.toString()}`,
  )
}

export function createRegistryImport(
  locationId: string,
  file: File,
  importType: RegistryImportType,
) {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('import_type', importType)

  return apiRequest<{ data: RegistryImportSummary }>(
    `/api/locations/${locationId}/registry-imports`,
    {
      data: formData,
      method: 'POST',
    },
  )
}

export function confirmRegistryImport(importId: string) {
  return apiRequest<{ data: RegistryImportSummary }>(
    `/api/registry-imports/${importId}/confirm`,
    {
      method: 'POST',
    },
  )
}

export function retryRegistryImport(importId: string) {
  return apiRequest<{ data: RegistryImportSummary }>(
    `/api/registry-imports/${importId}/retry`,
    {
      method: 'POST',
    },
  )
}
