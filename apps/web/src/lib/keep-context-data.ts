import type { QueryKey } from '@tanstack/react-query'

/** Keep pagination/filter results only within the query's resource and context.
 * Pass the stable key prefix through the account/location IDs, excluding
 * changing parameters such as page, filters, month, or week.
 */
export function keepContextData(contextKey: readonly (string | number)[]) {
  return <T>(previousData: T | undefined, previousQuery: { queryKey: QueryKey } | undefined): T | undefined =>
    previousQuery && contextKey.every((part, index) => previousQuery.queryKey[index] === part)
      ? previousData
      : undefined
}
