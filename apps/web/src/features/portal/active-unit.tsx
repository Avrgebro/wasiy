import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMe } from '../auth/hooks'
import { ActiveUnitContext, type ActiveUnitContextValue } from './active-unit-context'

const STORAGE_KEY = 'wasiy.portal.unit'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * The portal shows one unit at a time (roadmap decision). The choice lives
 * in localStorage so it survives reloads; it falls back to the primary
 * contact's unit, then the first membership.
 */
export function ActiveUnitProvider({ children }: { children: ReactNode }) {
  const me = useMe().data
  const units = useMemo(() => {
    const memberships = me?.resident_memberships ?? []

    return [...memberships].sort((a, b) => Number(b.is_primary_contact) - Number(a.is_primary_contact))
  }, [me])
  const [selectedId, setSelectedId] = useState<string | null>(readStored)

  const active = units.find((unit) => unit.unit_id === selectedId) ?? units[0] ?? null

  useEffect(() => {
    try {
      if (active) window.localStorage.setItem(STORAGE_KEY, active.unit_id)
    } catch {
      // Storage may be unavailable; the in-memory choice still works.
    }
  }, [active])

  const value = useMemo<ActiveUnitContextValue>(() => ({ units, active, select: setSelectedId }), [units, active])

  return <ActiveUnitContext.Provider value={value}>{children}</ActiveUnitContext.Provider>
}
