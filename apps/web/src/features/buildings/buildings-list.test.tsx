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
      { id: 'bd_a', location_id: 'loc_1', name: 'Torre A', sort_order: 1, units_count: 3 },
      { id: 'bd_b', location_id: 'loc_1', name: 'Torre B', sort_order: 2, units_count: 0 },
    ])
    renderList()
    const user = userEvent.setup()

    // Torre A has units: its delete is disabled. Torre B is empty: enabled.
    expect(await screen.findByRole('button', { name: 'Eliminar Torre A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Eliminar Torre B' })).toBeEnabled()
    expect(screen.getByText('3 unidades')).toBeInTheDocument()
    expect(screen.getByText('Sin unidades')).toBeInTheDocument()

    // Click the name to rename in place; Enter saves.
    await user.click(screen.getByRole('button', { name: 'Torre A' }))
    const nameInput = screen.getByLabelText('Nombre')
    await user.clear(nameInput)
    await user.type(nameInput, 'Torre Norte{Enter}')
    await waitFor(() => expect(writes[0]).toEqual({ method: 'patch', url: '/api/buildings/bd_a', body: { name: 'Torre Norte' } }))

    // Add opens a tile in the grid; submitting posts the name.
    await user.click(screen.getByRole('button', { name: 'Agregar torre' }))
    await user.type(screen.getByPlaceholderText('Torre B'), 'Torre C')
    await user.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(writes[1]).toEqual({ method: 'post', url: '/api/locations/loc_1/buildings', body: { name: 'Torre C' } }))
  })

  it('hides the default tower behind a switch and splits into two towers on save', async () => {
    const writes = install([{ id: 'bd_a', location_id: 'loc_1', name: null, sort_order: 0, units_count: 12 }])
    renderList()
    const user = userEvent.setup()

    const toggle = await screen.findByRole('switch', { name: /varias torres/ })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText(/Una sola torre/)).toBeInTheDocument()
    // No row, no delete affordance for the internal default tower.
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByText(/12 unidades existentes quedan en la primera torre/)).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Guardar' })
    expect(save).toBeDisabled()

    await user.type(screen.getByLabelText(/torre actual/), 'Torre A')
    await user.type(screen.getByLabelText(/nueva torre/), 'Torre B')
    await user.click(save)

    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toEqual({ method: 'patch', url: '/api/buildings/bd_a', body: { name: 'Torre A' } })
    expect(writes[1]).toEqual({ method: 'post', url: '/api/locations/loc_1/buildings', body: { name: 'Torre B' } })
  })

  it('blocks going back to one tower while other towers hold units', async () => {
    install([
      { id: 'bd_a', location_id: 'loc_1', name: 'Torre A', sort_order: 1, units_count: 3 },
      { id: 'bd_b', location_id: 'loc_1', name: 'Torre B', sort_order: 2, units_count: 2 },
    ])
    renderList()

    const toggle = await screen.findByRole('switch', { name: /varias torres/ })
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
  })
})
