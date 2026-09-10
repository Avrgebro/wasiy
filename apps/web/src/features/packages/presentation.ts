import type { PackageStatus } from './api'

/** Pill color for a package status: waiting at the desk is a warning, delivered is done. */
export function packageStatusColor(status: PackageStatus): string {
  return status === 'pending' ? 'warning' : 'success'
}
