import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import '../../i18n'
import type { BuildingSummary } from './api'
import { BuildingsList } from './buildings-list'

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(config: AxiosResponse['config'], data: unknown, status = 200): AxiosResponse {
  return { config, data, headers: {}, status, statusText: 'OK' }
}

function install(rows: BuildingSummary[]) {
  const writes: { method: string; url: string; body: unknown }[] = []
  apiClient.defaults.adapter = vi.fn<AxiosAdapter>((config) => {
    const url = config.url ?? ''
    if (config.method === 'get') return Promise.resolve(axiosResponse(config, { data: rows }))
    writes.push({ method: config.method ?? '', url, body: config.data ? JSON.parse(config.data as string) : null })
    return Promise.resolve(axiosResponse(config, { data: rows[0] }))
  })
  return writes
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MantineProvider env="test">
      <Notifications autoClose={false} />
      <QueryClientProvider client={queryClient}>
        <BuildingsList locationId="loc_1" />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
})

describe('BuildingsList', () => {
  it('renames in place, blocks deleting towers in use or the last one, and adds towers', async () => {
    const writes = install([
      { id: 'bd_a', location_id: 'loc_1', name: 'Torre A', code: 'TA', sort_order: 1, units_count: 3 },
      { id: 'bd_b', location_id: 'loc_1', name: 'Torre B', code: null, sort_order: 2, units_count: 0 },
    ])
    renderList()
    const user = userEvent.setup()

    const nameInputs = await screen.findAllByLabelText(/Nombre/)
    expect(nameInputs).toHaveLength(2)
    expect(screen.getByText('3 unidades')).toBeInTheDocument()

    // Torre A has units: its delete is disabled. Torre B is empty: enabled.
    expect(screen.getByRole('button', { name: 'Eliminar Torre A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar Torre B' })).toBeEnabled()

    await user.clear(nameInputs[0])
    await user.type(nameInputs[0], 'Torre Norte')
    await user.click(screen.getAllByRole('button', { name: 'Guardar' })[0])
    await waitFor(() => expect(writes[0]).toEqual({ method: 'patch', url: '/api/buildings/bd_a', body: { name: 'Torre Norte', code: 'TA' } }))

    await user.click(screen.getByRole('button', { name: 'Agregar torre' }))
    await user.type(screen.getByPlaceholderText('Torre B'), 'Torre C')
    await user.click(screen.getByRole('button', { name: 'Agregar torre' }))
    await waitFor(() => expect(writes[1]).toEqual({ method: 'post', url: '/api/locations/loc_1/buildings', body: { name: 'Torre C' } }))
  })

  it('keeps the only building undeletable and explains the single-tower state', async () => {
    install([{ id: 'bd_a', location_id: 'loc_1', name: null, code: null, sort_order: 0, units_count: 12 }])
    renderList()

    expect(await screen.findByText(/Una sola torre/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar Sin nombre' })).toBeDisabled()
  })
})
