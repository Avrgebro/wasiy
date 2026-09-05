import { createContext, useContext } from 'react'
import type { ResidentMembership } from '../auth/types'

export type ActiveUnitContextValue = {
  /** Every unit the resident lives in, primary contact first. */
  units: ResidentMembership[]
  active: ResidentMembership | null
  select: (unitId: string) => void
}

export const ActiveUnitContext = createContext<ActiveUnitContextValue | null>(null)


export function useActiveUnit() {
  const context = useContext(ActiveUnitContext)
  if (!context) throw new Error('useActiveUnit must be used inside ActiveUnitProvider')

  return context
}
