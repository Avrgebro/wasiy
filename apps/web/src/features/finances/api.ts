import { apiRequest } from '../../app/api-client'
import { buildParams } from '../../lib/query-params'
import type { PaginatedApiResponse } from '../registry/types'

export type MovementDirection = 'income' | 'expense'

export type MovementCategory =
  | 'reservation_fee'
  | 'reservation_deposit'
  | 'utility'
  | 'cleaning'
  | 'maintenance'
  | 'other'

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

export type FinanceSummary = {
  month: string
  income_total: number
  income_count: number
  expense_total: number
  expense_count: number
  balance: number
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
