/** The Laravel paginator envelope every list endpoint returns. */
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
