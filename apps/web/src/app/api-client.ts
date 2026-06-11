import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost'
).replace(/\/$/, '')

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: 'application/json',
  },
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
})

export class ApiError extends Error {
  readonly body?: unknown
  readonly errors?: Record<string, string[]>
  readonly status: number

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
    body?: unknown,
  ) {
    super(message)
    this.status = status
    this.errors = errors
    this.body = body
  }
}

// The callback must be idempotent: it fires for every 401, including ones
// already being resolved into an anonymous session by getSession.
export function installAuthInterceptors(onUnauthorized: () => void) {
  return apiClient.interceptors.response.use(undefined, (error: AxiosError) => {
    if (error.response?.status === 401) {
      onUnauthorized()
    }

    return Promise.reject(error)
  })
}

// ApiError.message carries the server-provided message when there is one and
// stays empty otherwise; getErrorMessage() in lib/errors.ts supplies the
// localized fallback so this module stays free of i18n concerns.
function toApiError(error: unknown) {
  if (!axios.isAxiosError(error) || !error.response) {
    return new ApiError('', 0)
  }

  const body = error.response.data as {
    errors?: Record<string, string[]>
    message?: string
  }

  return new ApiError(
    body?.message ?? '',
    error.response.status,
    body?.errors,
    error.response.data,
  )
}

export async function csrfCookie() {
  try {
    await apiClient.get('/sanctum/csrf-cookie')
  } catch (error) {
    throw toApiError(error)
  }
}

export async function apiRequest<T>(
  url: string,
  config: Omit<AxiosRequestConfig, 'baseURL' | 'url'> = {},
): Promise<T> {
  try {
    const response = await apiClient.request<T>({ ...config, url })

    return response.status === 204 ? (undefined as T) : response.data
  } catch (error) {
    throw toApiError(error as AxiosError)
  }
}
