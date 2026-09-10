/** Pill color for a resident (person) record status. */
export function residentStatusColor(status: 'active' | 'inactive'): string {
  return status === 'active' ? 'success' : 'gray'
}
