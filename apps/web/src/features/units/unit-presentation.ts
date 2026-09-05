import type { TFunction } from 'i18next'
import type { UnitOccupancy, UnitPortalState, UnitSummary, UnitType } from './api'

/** Colors and labels shared by the list, the header and the drawers. */
export function occupancyColor(occupancy: UnitOccupancy): string {
  return { occupied: 'success', vacant: 'gray', attention: 'warning' }[occupancy]
}

export function portalColor(state: UnitPortalState): string {
  return state === 'active' ? 'success' : state === 'invited' ? 'info' : 'gray'
}

export function typeLabel(type: UnitType, t: TFunction, short = false): string {
  return t(`units.types${short ? 'Short' : ''}.${type}`)
}

/** "Piso 4 · Depto." — the second identity line. */
export function unitDescriptor(unit: UnitSummary, t: TFunction): string {
  return [
    unit.floor ? t('units.floorN', { floor: unit.floor }) : null,
    typeLabel(unit.type, t, true),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "E-12, E-13 · D-04" — parking and storage labels under the number. */
export function unitLabelsLine(unit: Pick<UnitSummary, 'parking_spots' | 'storage_rooms'>): string | null {
  const parts = [unit.parking_spots.join(', '), unit.storage_rooms.join(', ')].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : null
}
