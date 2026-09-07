import { apiRequest } from '../../app/api-client'
import type { AuthUser } from '../auth/types'

export type PendingEmailChange = { email: string; resend_after: number }
export type AccountSession = { id: string; device: string; ip_address: string | null; last_active_at: string; is_current: boolean }

export const updateProfile = (data: { first_name: string; last_name: string }) =>
  apiRequest<{ data: AuthUser }>('/api/me/profile', { method: 'PATCH', data })

export const changePassword = (data: { current_password: string; password: string; password_confirmation: string }) =>
  apiRequest<void>('/api/me/password', { method: 'PATCH', data })

// The change awaiting its code in this session; a reopened tab resumes on step 2.
export const getEmailChange = () => apiRequest<{ data: PendingEmailChange | null }>('/api/me/email')
export const requestEmailChange = (data: { current_password: string; email: string }) =>
  apiRequest<{ data: PendingEmailChange }>('/api/me/email/request', { method: 'POST', data })
export const resendEmailChange = () => apiRequest<{ data: PendingEmailChange }>('/api/me/email/resend', { method: 'POST' })
export const verifyEmailChange = (code: string) => apiRequest<{ data: AuthUser }>('/api/me/email/verify', { method: 'POST', data: { code } })
export const cancelEmailChange = () => apiRequest<void>('/api/me/email', { method: 'DELETE' })

export const getSessions = () => apiRequest<{ data: AccountSession[] }>('/api/me/sessions')
export const closeOtherSessions = (data: { current_password: string }) =>
  apiRequest<void>('/api/me/sessions/others', { method: 'DELETE', data })
