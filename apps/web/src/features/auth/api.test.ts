import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient } from '../../app/api-client'
import { getSession } from './api'

const originalAdapter = apiClient.defaults.adapter

function failWithStatus(status: number, message: string) {
  apiClient.defaults.adapter = vi.fn((config) =>
    Promise.reject(
      new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
        config,
        data: { message },
        headers: {},
        status,
        statusText: 'Error',
      } satisfies AxiosResponse),
    ),
  ) satisfies AxiosAdapter
}

describe('getSession', () => {
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('resolves an authenticated session from /api/me', async () => {
    const me = { user: { id: 'usr_1' } }

    apiClient.defaults.adapter = vi.fn((config) =>
      Promise.resolve({
        config,
        data: me,
        headers: {},
        status: 200,
        statusText: 'OK',
      } satisfies AxiosResponse),
    ) satisfies AxiosAdapter

    await expect(getSession()).resolves.toEqual({
      status: 'authenticated',
      me,
    })
  })

  it('resolves an anonymous session for 401 responses', async () => {
    failWithStatus(401, 'Unauthenticated.')

    await expect(getSession()).resolves.toEqual({ status: 'anonymous' })
  })

  it('resolves a deactivated session for 403 responses', async () => {
    failWithStatus(403, 'User account is deactivated.')

    await expect(getSession()).resolves.toEqual({ status: 'deactivated' })
  })

  it('rethrows exceptional failures so they reach the error boundary', async () => {
    apiClient.defaults.adapter = vi.fn(() =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK')),
    ) satisfies AxiosAdapter

    await expect(getSession()).rejects.toBeInstanceOf(ApiError)
    await expect(getSession()).rejects.toMatchObject({ status: 0 })

    failWithStatus(500, 'Server Error')

    await expect(getSession()).rejects.toMatchObject({ status: 500 })
  })
})
