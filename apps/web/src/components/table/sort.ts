/**
 * Server sort strings follow ADR 0011: "field,-other", a leading minus for
 * descending. These helpers own the header-click cycle.
 */
/** Parse the first field of a "field,-other" sort string (ADR 0011). */
export function parseSort(sort: string | undefined): { key: string; desc: boolean } | null {
  const first = (sort ?? '').split(',')[0]?.trim()

  if (!first) {
    return null
  }

  return { key: first.replace(/^-/, ''), desc: first.startsWith('-') }
}

/** Next sort string for a header click: asc → desc → cleared. */
export function nextSort(current: string | undefined, key: string): string {
  const active = parseSort(current)

  if (active?.key !== key) {
    return key
  }

  return active.desc ? '' : `-${key}`
}
