import { formatUnitLabel } from '../units/unit-label'
import type { RegistryImportSummary } from './api'

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function locationLabel(
  registryImport: RegistryImportSummary,
  currentLocationName?: string,
) {
  return registryImport.location?.name
    ?? registryImport.location_name
    ?? currentLocationName
    ?? registryImport.location_id
}

export function unitLabel(normalizedData: Record<string, unknown>) {
  return (
    formatUnitLabel({
      building_name: stringValue(normalizedData.building_name) || null,
      unit_number: stringValue(normalizedData.unit_number),
    }) || '-'
  )
}

export function residentLabel(normalizedData: Record<string, unknown>) {
  return (
    [
      stringValue(normalizedData.first_name),
      stringValue(normalizedData.last_name),
    ]
      .filter(Boolean)
      .join(' ') || '-'
  )
}
