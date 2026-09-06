import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'
import { keepContextData } from './keep-context-data'

afterEach(cleanup)

it.each(['page', 'filter', 'location', 'account'] as const)('handles a pending %s change without crossing context', async (change) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const initial = { account: 'a', location: 'one', page: 1, filter: '' }
  let release!: (rows: string[]) => void
  const pending = new Promise<string[]>((resolve) => { release = resolve })
  const { result, rerender } = renderHook((props: typeof initial) => useQuery({
    queryKey: ['rows', props.account, props.location, props.page, props.filter],
    queryFn: () => props === initial ? Promise.resolve(['old row']) : pending,
    placeholderData: keepContextData(['rows', props.account, props.location]),
  }), {
    initialProps: initial,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  rerender({ ...initial, [change]: change === 'page' ? 2 : 'other' })
  expect(result.current.isFetching).toBe(true)
  const sameContext = change === 'page' || change === 'filter'
  expect(result.current.data).toEqual(sameContext ? ['old row'] : undefined)
  expect(result.current.isLoading).toBe(!sameContext)
  expect(result.current.isPlaceholderData).toBe(sameContext)
  await act(async () => release(['new row']))
  await waitFor(() => expect(result.current.data).toEqual(['new row']))
  client.clear()
})

it('shows cached destination data immediately instead of the previous context', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(['rows', 'a'], ['A'])
  client.setQueryData(['rows', 'b'], ['B'])
  const { result, rerender } = renderHook(({ location }) => useQuery({
    queryKey: ['rows', location],
    queryFn: async () => ['fetched'],
    placeholderData: keepContextData(['rows', location]),
  }), {
    initialProps: { location: 'a' },
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  expect(result.current.data).toEqual(['A'])
  rerender({ location: 'b' })
  expect(result.current.data).toEqual(['B'])
  expect(result.current.isLoading).toBe(false)
  expect(result.current.isPlaceholderData).toBe(false)
  client.clear()
})
