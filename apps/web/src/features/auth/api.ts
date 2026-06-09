import { apiRequest, csrfCookie } from '../../app/api-client'
import type { LoginCredentials, MeResponse } from './types'

export function getMe() {
  return apiRequest<MeResponse>('/api/me')
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
