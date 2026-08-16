/**
 * Build URLSearchParams from a record, skipping empty values (undefined,
 * null, '', 0). The single owner of the query-string idiom the api modules
 * previously hand-rolled per endpoint.
 */
export function buildParams(
  values: Record<string, string | number | null | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value))
    }
  })

  return params
}
