import { z } from 'zod'
import type { UnitsSearch } from './api'

export const unitSchema = z.object({
  building_name: z.string().trim().max(255).nullable(),
  floor: z.string().trim().max(255).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  status: z.enum(['active', 'inactive']),
  unit_number: z.string().trim().min(1, 'validation.unitRequired').max(255),
})

export type UnitFormValues = z.infer<typeof unitSchema>

export const UNIT_CHIPS = ['occupied', 'vacant', 'attention', 'no_portal', 'no_fee'] as const
export type UnitChip = (typeof UNIT_CHIPS)[number]

/**
 * URL contract for /admin/registry/units (mockup 11). `chip` is the quick
 * filter row; `type` and `status` live behind Filtros; `search` reaches
 * unit, building, resident names and plates on the server.
 */
export const unitsSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  search: z.string().catch(''),
  sort: z.string().catch(''),
  chip: z.enum(UNIT_CHIPS).optional().catch(undefined),
  type: z.string().catch(''),
  status: z.string().catch(''),
})

export type UnitsSearchValues = z.infer<typeof unitsSearchSchema>

export function chipParams(chip: UnitChip | undefined): Pick<UnitsSearch, 'occupancy' | 'portal' | 'fee'> {
  switch (chip) {
    case 'occupied':
      return { occupancy: 'occupied' }
    case 'vacant':
      return { occupancy: 'vacant' }
    case 'attention':
      return { occupancy: 'attention' }
    case 'no_portal':
      return { portal: 'none' }
    case 'no_fee':
      return { fee: 'missing' }
    default:
      return {}
  }
}
