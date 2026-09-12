import { QueryClientProvider, useMutation } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../i18n'
import { ERROR_TOAST_AUTO_CLOSE, queryClient } from './query-client'
import { notifyError } from '../lib/notify'

vi.mock('../lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn(), notifyWarning: vi.fn(), notifyInfo: vi.fn() }))

const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

afterEach(() => vi.mocked(notifyError).mockClear())

describe('queryClient mutation errors', () => {
  it('toasts a failed mutation exactly once, titled, with the longer auto-close', async () => {
    const { result } = renderHook(() => useMutation({ mutationFn: () => Promise.reject(new Error('boom')) }), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(notifyError).toHaveBeenCalledWith('boom', 'No se pudo completar la acción', { autoClose: ERROR_TOAST_AUTO_CLOSE })
  })

  it('stays quiet for mutations that surface the error inline', async () => {
    const { result } = renderHook(
      () => useMutation({ meta: { suppressErrorNotification: true }, mutationFn: () => Promise.reject(new Error('boom')) }),
      { wrapper },
    )
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(notifyError).not.toHaveBeenCalled()
  })
})
