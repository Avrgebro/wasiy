import { apiRequest, csrfCookie } from '../../app/api-client'
import type { LoginCredentials, MeResponse } from './types'

export function getMe() {
  return apiRequest<MeResponse>('/api/me')
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
