import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiClient,
  apiRequest,
  csrfCookie,
  installAuthInterceptors,
  isAuthBootstrapError,
  isDeactivatedAccountError,
} from './api-client'

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(
  config: AxiosResponse['config'],
  status = 204,
  data?: unknown,
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status,
    statusText: status === 204 ? 'No Content' : 'OK',
  }
}

describe('apiClient', () => {
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('is configured for Sanctum cookie auth', () => {
    expect(apiClient.defaults.withCredentials).toBe(true)
    expect(apiClient.defaults.withXSRFToken).toBe(true)
    expect(apiClient.defaults.xsrfCookieName).toBe('XSRF-TOKEN')
    expect(apiClient.defaults.xsrfHeaderName).toBe('X-XSRF-TOKEN')
  })

  it('does not treat network failures as auth bootstrap errors', async () => {
    apiClient.defaults.adapter = vi.fn(() =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK')),
    ) satisfies AxiosAdapter

    await expect(apiRequest('/api/me')).rejects.toMatchObject({
      message: '',
      status: 0,
    })

    try {
      await apiRequest('/api/me')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect(isAuthBootstrapError(error)).toBe(false)
      expect(isDeactivatedAccountError(error)).toBe(false)
    }
  })

  it('classifies unauthenticated and deactivated responses', () => {
    expect(isAuthBootstrapError(new ApiError('Unauthenticated.', 401))).toBe(
      true,
    )
    expect(
      isDeactivatedAccountError(
        new ApiError('User account is deactivated.', 403),
      ),
    ).toBe(true)
    expect(
      isAuthBootstrapError(new ApiError('User account is deactivated.', 403)),
    ).toBe(false)
    expect(isDeactivatedAccountError(new ApiError('Unauthenticated.', 401))).toBe(
      false,
    )
  })

  it('calls the installed unauthorized callback for unauthorized responses', async () => {
    const onUnauthorized = vi.fn()
    const interceptorId = installAuthInterceptors(onUnauthorized)

    apiClient.defaults.adapter = vi.fn((config) =>
      Promise.reject(
        new AxiosError(
          'Unauthenticated.',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          axiosResponse(config, 401, { message: 'Unauthenticated.' }),
        ),
      ),
    ) satisfies AxiosAdapter

    await expect(
      apiRequest('/api/locations/loc_1/dashboard'),
    ).rejects.toMatchObject({ status: 401 })

    expect(onUnauthorized).toHaveBeenCalledOnce()
    apiClient.interceptors.response.eject(interceptorId)
  })

  it('leaves /api/me unauthorized responses to the route guards', async () => {
    const onUnauthorized = vi.fn()
    const interceptorId = installAuthInterceptors(onUnauthorized)

    apiClient.defaults.adapter = vi.fn((config) =>
      Promise.reject(
        new AxiosError(
          'Unauthenticated.',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          axiosResponse(config, 401, { message: 'Unauthenticated.' }),
        ),
      ),
    ) satisfies AxiosAdapter

    await expect(apiRequest('/api/me')).rejects.toMatchObject({ status: 401 })

    expect(onUnauthorized).not.toHaveBeenCalled()
    apiClient.interceptors.response.eject(interceptorId)
  })

  it('requests the Sanctum csrf cookie when asked', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) => {
      return Promise.resolve(axiosResponse(config))
    })

    apiClient.defaults.adapter = adapter

    await csrfCookie()

    expect(adapter).toHaveBeenCalledOnce()
    expect(adapter.mock.calls[0]?.[0].url).toBe('/sanctum/csrf-cookie')
  })
})
