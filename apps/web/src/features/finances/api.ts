import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type MovementDirection = 'income' | 'expense'

export type MovementCategory =
  | 'reservation_fee'
  | 'reservation_deposit'
  | 'maintenance_dues'
  | 'fine'
  | 'other_income'
  | 'water'
  | 'electricity'
  | 'gas'
  | 'telecom'
  | 'cleaning'
  | 'maintenance'
  | 'security'
  | 'staff'
  | 'supplies'
  | 'gardening'
  | 'insurance_taxes'
  | 'administration'
  | 'other_expense'

export type MovementStatus =
  | 'pending'
  | 'paid'
  | 'held'
  | 'to_refund'
  | 'refunded'
  | 'retained'
  | 'voided'

export type MovementSummary = {
  id: string
  account_id: string
  location_id: string
  direction: MovementDirection
  category: MovementCategory
  status: MovementStatus
  allowed_transitions: MovementStatus[]
  amount: number
  concept: string
  detail: string | null
  counterparty: string | null
  unit_id: string | null
  unit_number?: string | null
  reservation_id: string | null
  /** Present on the show endpoint when the row was opened by a booking. */
  reservation?: {
    id: string
    amenity_name: string | null
    starts_at: string
    status: string
  } | null
  occurred_on: string
  due_on: string | null
  note: string | null
  created_by: string
  created_by_name?: string | null
  settled_by: string | null
  settled_by_name?: string | null
  settled_at: string | null
  created_at: string | null
}

export type CategoryTotal = { category: MovementCategory; total: number; count: number }

export type FinanceSummary = {
  month: string
  income_total: number
  income_count: number
  income_by_category: CategoryTotal[]
  expense_total: number
  expense_count: number
  expense_by_category: CategoryTotal[]
  balance: number
  previous_month: string
  previous_balance: number
  receivable_total: number
  receivable_count: number
  payable_total: number
  payable_count: number
  deposits_held_total: number
  deposits_to_refund_total: number
  deposits_to_refund_count: number
}

export type MovementsSearch = {
  month?: string
  direction?: MovementDirection
  status?: string
  category?: string
  search?: string
  sort?: string
  page?: number
  per_page?: number
}

function base(accountId: string, locationId: string) {
  return `/api/accounts/${accountId}/locations/${locationId}/finances`
}

export function getMovements(accountId: string, locationId: string, search: MovementsSearch) {
  const params = buildParams(search)

  return apiRequest<PaginatedApiResponse<MovementSummary>>(
    `${base(accountId, locationId)}/movements?${params.toString()}`,
  )
}

export function getFinanceSummary(accountId: string, locationId: string, month: string) {
  return apiRequest<{ data: FinanceSummary }>(`${base(accountId, locationId)}/summary?month=${month}`)
}

export type MovementHistoryEntry = {
  id: string
  event_type: 'movement.recorded' | 'movement.status_changed'
  status: MovementStatus | null
  previous_status: MovementStatus | null
  actor_name: string | null
  created_at: string | null
}

export type MovementDetailResponse = { data: MovementSummary; history: MovementHistoryEntry[] }

export function getMovement(accountId: string, movementId: string) {
  return apiRequest<MovementDetailResponse>(`/api/accounts/${accountId}/finances/movements/${movementId}`)
}

export type MovementPayload = {
  direction: MovementDirection
  category: MovementCategory
  status?: MovementStatus
  amount: number
  concept: string
  detail?: string | null
  counterparty?: string | null
  unit_id?: string | null
  occurred_on: string
  due_on?: string | null
  note?: string | null
}

export function recordMovement(accountId: string, locationId: string, payload: MovementPayload) {
  return apiRequest<{ data: MovementSummary }>(`${base(accountId, locationId)}/movements`, {
    method: 'POST',
    data: payload,
  })
}

export function transitionMovement(
  accountId: string,
  movementId: string,
  status: MovementStatus,
  note?: string,
) {
  return apiRequest<{ data: MovementSummary }>(
    `/api/accounts/${accountId}/finances/movements/${movementId}/status`,
    { method: 'POST', data: note === undefined ? { status } : { status, note } },
  )
}

/** "Generar cuotas del mes": one pending dues movement per unit with a fee; idempotent per month. */
export function generateDues(accountId: string, locationId: string, month: string) {
  return apiRequest<{ data: { created: number; skipped: number } }>(`${base(accountId, locationId)}/dues`, {
    method: 'POST',
    data: { month },
  })
}
