import { apiClient, apiRequest } from '../../app/api-client'
import type { SubscriptionStatus } from '../auth/types'

export type InvoiceStatus = 'pending' | 'under_review' | 'paid' | 'rejected'
export type PaymentMethod = 'transfer' | 'card'

export type Invoice = {
  id: string
  number: string
  period_starts_on: string
  period_ends_on: string
  amount_minor: number
  currency: string
  status: InvoiceStatus
  due_on: string
  paid_at: string | null
  payment_method: PaymentMethod | null
  rejection_reason: string | null
  latest_proof: PaymentProof | null
}

export type PaymentProof = {
  id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  paid_on: string | null
  amount_minor: number | null
  operation_number: string | null
  uploaded_at: string
}

export type PlanOption = {
  code: string
  name: string
  unit_price_minor: number
  included_units: number
  features: string[]
  /** For this account's contracted units (ADR 0040). */
  total_minor: number
  is_current: boolean
}

export type PaymentInstructions = {
  transfer: { bank: string; account_type: string; account_number: string; cci: string | null; holder: string; tax_id: string | null } | null
  yape: { number: string; holder: string } | null
  plin: { number: string; holder: string } | null
}

export type SubscriptionPageData = {
  account: { id: string; name: string }
  plan: { code: string; name: string; unit_price_minor: number; currency: string; included_units: number; features: string[] }
  subscription: {
    status: SubscriptionStatus
    trial_ends_at: string
    access_until: string
    days_left: number
    is_lapsed: boolean
    billable_units: number
    units_in_use: number
    pending_billable_units: number | null
    pending_units_from: string | null
    last_paid_at: string | null
  }
  breakdown: { base_units: number; base_minor: number; extra_units: number; extra_minor: number; total_minor: number }
  invoices: Invoice[]
  payment_instructions: PaymentInstructions | null
  plans: PlanOption[]
  contact_email: string
}

export const subscriptionPageQueryKey = ['subscription', 'page'] as const

export const getSubscriptionPage = () => apiRequest<{ data: SubscriptionPageData | null }>('/api/account/subscription')

export type ProofDetails = { paid_on?: string; amount_minor?: number; operation_number?: string }

/** Multipart: the file plus whatever details the admin filled in (mockup 22c). */
export function uploadPaymentProof(invoiceId: string, file: File, details: ProofDetails) {
  const data = new FormData()
  data.append('file', file)
  if (details.paid_on) data.append('paid_on', details.paid_on)
  if (details.amount_minor) data.append('amount_minor', String(details.amount_minor))
  if (details.operation_number) data.append('operation_number', details.operation_number)

  return apiRequest<{ data: PaymentProof }>(`/api/account/invoices/${invoiceId}/proofs`, { data, method: 'POST' })
}

/** Streams through the API with the session cookie, so a plain link works. */
export function paymentProofUrl(invoiceId: string, proofId: string) {
  return `${apiClient.defaults.baseURL ?? ''}/api/account/invoices/${invoiceId}/proofs/${proofId}`
}
