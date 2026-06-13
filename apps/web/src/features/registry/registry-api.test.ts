import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../app/api-client'
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
      '/api/locations/loc_1/units?page=2&per_page=25&search=torre&status=active&sort=-resident_count',
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
      '/api/accounts/acc_1/residents?page=1&per_page=15&search=ana&status=inactive&location_id=loc_1',
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
})
