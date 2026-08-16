import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
import {
  confirmRegistryImport,
  createRegistryImport,
  getRegistryImportRows,
  getRegistryImports,
} from '../imports/api'
import { getResidents } from '../residents/api'
import { getUnits } from '../units/api'
import { getVehicles } from '../vehicles/api'

const originalAdapter = apiClient.defaults.adapter

function axiosResponse(
  config: AxiosResponse['config'],
  data: unknown,
): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status: 200,
    statusText: 'OK',
  }
}

describe('registry API helpers', () => {
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  it('sends units table state as query params', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(axiosResponse(config, { data: [], meta: {} })),
    )
    apiClient.defaults.adapter = adapter

    await getUnits('loc_1', {
      page: 2,
      per_page: 25,
      search: 'torre',
      sort: '-resident_count',
      status: 'active',
    })

    expect(adapter.mock.calls[0]?.[0].url).toBe(
      '/api/locations/loc_1/units?page=2&per_page=25&search=torre&sort=-resident_count&status=active',
    )
  })

  it('sends residents table state as account scoped query params', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(axiosResponse(config, { data: [], meta: {} })),
    )
    apiClient.defaults.adapter = adapter

    await getResidents('acc_1', {
      location_id: 'loc_1',
      page: 1,
      per_page: 15,
      search: 'ana',
      status: 'inactive',
    })

    expect(adapter.mock.calls[0]?.[0].url).toBe(
      '/api/accounts/acc_1/residents?location_id=loc_1&page=1&per_page=15&search=ana&status=inactive',
    )
  })

  it('sends vehicles table state with vehicle type filter', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(axiosResponse(config, { data: [], meta: {} })),
    )
    apiClient.defaults.adapter = adapter

    await getVehicles('loc_1', {
      page: 3,
      per_page: 10,
      search: 'toyota',
      status: 'active',
      vehicle_type: 'car',
    })

    expect(adapter.mock.calls[0]?.[0].url).toBe(
      '/api/locations/loc_1/vehicles?page=3&per_page=10&search=toyota&status=active&vehicle_type=car',
    )
  })

  it('uploads registry imports as multipart data to the location scoped endpoint', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(axiosResponse(config, { data: { id: 'imp_1' } })),
    )
    apiClient.defaults.adapter = adapter
    const file = new File(['unidad\n301\n'], 'registro.csv', { type: 'text/csv' })

    await createRegistryImport('loc_1', file, 'registry_units_residents')

    expect(adapter.mock.calls[0]?.[0].url).toBe(
      '/api/locations/loc_1/registry-imports',
    )
    expect(adapter.mock.calls[0]?.[0].method).toBe('post')
    expect(adapter.mock.calls[0]?.[0].data).toBeInstanceOf(FormData)
    expect((adapter.mock.calls[0]?.[0].data as FormData).get('file')).toBe(file)
    expect((adapter.mock.calls[0]?.[0].data as FormData).get('import_type')).toBe(
      'registry_units_residents',
    )
  })

  it('sends import list and row preview query params', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(axiosResponse(config, { data: [], meta: {} })),
    )
    apiClient.defaults.adapter = adapter

    await getRegistryImports({
      account_id: 'acc_1',
      import_type: 'registry_units_residents',
      location_id: 'loc_1',
      page: 2,
      per_page: 25,
      status: 'ready_for_review',
    })
    await getRegistryImportRows('imp_1', {
      page: 3,
      per_page: 10,
      search: 'ana',
      status: 'error',
    })

    expect(adapter.mock.calls[0]?.[0].url).toBe(
      '/api/registry-imports?account_id=acc_1&import_type=registry_units_residents&location_id=loc_1&page=2&per_page=25&status=ready_for_review',
    )
    expect(adapter.mock.calls[1]?.[0].url).toBe(
      '/api/registry-imports/imp_1/rows?page=3&per_page=10&search=ana&status=error',
    )
  })

  it('confirms registry imports through the confirm endpoint', async () => {
    const adapter = vi.fn<AxiosAdapter>((config) =>
      Promise.resolve(axiosResponse(config, { data: { id: 'imp_1' } })),
    )
    apiClient.defaults.adapter = adapter

    await confirmRegistryImport('imp_1')

    expect(adapter.mock.calls[0]?.[0].url).toBe(
      '/api/registry-imports/imp_1/confirm',
    )
    expect(adapter.mock.calls[0]?.[0].method).toBe('post')
  })
})
