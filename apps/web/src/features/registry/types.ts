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

