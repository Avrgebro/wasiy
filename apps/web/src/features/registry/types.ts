export type PaginatedApiResponse<T> = {
  data: T[]
  links?: unknown
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type RegistrySearch = {
  page?: number
  per_page?: number
  search?: string
  status?: string
  sort?: string
}

export function appendRegistryParams(
  params: URLSearchParams,
  search: RegistrySearch,
) {
  if (search.page) params.set('page', String(search.page))
  if (search.per_page) params.set('per_page', String(search.per_page))
  if (search.search) params.set('search', search.search)
  if (search.status) params.set('status', search.status)
  if (search.sort) params.set('sort', search.sort)
}
