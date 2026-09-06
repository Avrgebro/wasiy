import type { TFunction } from 'i18next'
import type { UnitPortalState, UnitType } from './api'

/** Colors and labels shared by the list, the header and the drawers. */
export function portalColor(state: UnitPortalState): string {
  return state === 'active' ? 'success' : state === 'invited' ? 'info' : 'gray'
}

export function typeLabel(type: UnitType, t: TFunction, short = false): string {
  return t(`units.types${short ? 'Short' : ''}.${type}`)
}

