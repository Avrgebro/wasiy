import { apiRequest, csrfCookie } from '../../app/api-client'
import type { MeResponse } from '../auth/types'

export type PlanCode = 'esencial' | 'operativo'
export type RegistrationPlan = { code: PlanCode; name: string; unit_price_minor: number; currency: string; features: string[]; location_limit: number; included_units: number }
export type PendingRegistration = { first_name: string; last_name: string; email: string; verified: boolean; resend_after: number }
export const getRegistrationPlans = () => apiRequest<{ data: RegistrationPlan[] }>('/api/public/plans')
export const getPendingRegistration = () => apiRequest<{ data: PendingRegistration | null }>('/registration')
export async function startRegistration(data: { first_name: string; last_name: string; email: string; password: string; password_confirmation: string; terms_accepted: boolean }) {
  await csrfCookie()
  return apiRequest<{ data: PendingRegistration }>('/registration', { method: 'POST', data })
}
export async function resendRegistrationCode() {
  await csrfCookie()
  return apiRequest<{ data: PendingRegistration }>('/registration/resend', { method: 'POST' })
}
export async function verifyRegistrationCode(code: string) {
  await csrfCookie()
  return apiRequest<{ data: PendingRegistration }>('/registration/verify', { method: 'POST', data: { code } })
}
export type CountryCode = 'PE'
/** Self-serve signup is Peru-only for launch; the backend enforces the same list. */
export const registrationCountries: { value: CountryCode; label: string }[] = [{ value: 'PE', label: 'Perú' }]
export async function completeRegistration(data: { name: string; address: string; district: string; city: string; country: CountryCode; units: number; plan: PlanCode; unit_price_minor: number }) {
  await csrfCookie()
  return apiRequest<{ session: MeResponse }>('/registration/complete', { method: 'POST', data })
}
