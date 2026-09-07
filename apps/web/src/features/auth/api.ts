import { ApiError, apiRequest, csrfCookie } from '../../app/api-client'
import type { LoginCredentials, MeResponse, Session } from './types'

export async function getSession(): Promise<Session> {
  try {
    const me = await apiRequest<MeResponse>('/api/me')

    return { status: 'authenticated', me }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'anonymous' }
    }

    if (error instanceof ApiError && error.status === 403) {
      return { status: 'deactivated' }
    }

    throw error
  }
}

export function selectAccount(accountId: string) {
  return apiRequest<MeResponse>('/api/context/account', {
    data: {
      account_id: accountId,
    },
    method: 'POST',
  })
}

export function selectLocation(locationId: string) {
  return apiRequest<MeResponse>('/api/context/location', {
    data: {
      location_id: locationId,
    },
    method: 'POST',
  })
}

export async function login(credentials: LoginCredentials) {
  await csrfCookie()

  return apiRequest<void>('/login', {
    data: credentials,
    method: 'POST',
  })
}

export function logout() {
  return apiRequest<void>('/logout', {
    method: 'POST',
  })
}

export type PendingLoginCode = { email: string; resend_after: number }

// The outstanding code request in this session, if any, so a returning tab
// resumes on the code step instead of burning another code.
export function getPendingLoginCode() {
  return apiRequest<{ data: PendingLoginCode | null }>('/login/code')
}

// Passwordless login: the API always answers as if a code was sent.
export async function requestLoginCode(email: string) {
  await csrfCookie()

  return apiRequest<{ data: PendingLoginCode }>('/login/code/request', {
    data: { email },
    method: 'POST',
  })
}

export async function verifyLoginCode(input: { code: string; remember: boolean }) {
  await csrfCookie()

  return apiRequest<{ session: MeResponse }>('/login/code/verify', {
    data: input,
    method: 'POST',
  })
}
