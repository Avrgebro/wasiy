import { z } from 'zod'
import type { UnitsSearch } from './api'

const optionalNumber = z.union([z.number(), z.literal('')])

/** The unit drawer (mockup 12b): two sections, Identificación and Cuota y participación. */
export const unitSchema = z.object({
  unit_number: z.string().trim().min(1, 'validation.unitRequired').max(255),
  type: z.enum(['apartment', 'house', 'commercial', 'office']),
  building_name: z.string().trim().max(255),
  floor: z.string().trim().max(255),
  area_m2: optionalNumber,
  participation_share: optionalNumber.refine((value) => value === '' || Number(value) <= 100, 'validation.shareTooHigh'),
  maintenance_fee: optionalNumber,
  parking_spots: z.string().trim().max(255),
  storage_rooms: z.string().trim().max(255),
  notes: z.string().trim().max(5000),
})

export type UnitFormValues = z.infer<typeof unitSchema>

export type UnitPayload = {
  unit_number: string
  type: UnitFormValues['type']
  building_name: string | null
  floor: string | null
  area_m2: number | null
  participation_share: number | null
  maintenance_fee: number | null
  parking_spots: string | null
  storage_rooms: string | null
  notes: string | null
}

export function toUnitPayload(values: UnitFormValues): UnitPayload {
  const number = (value: number | '') => (value === '' ? null : Number(value))

  return {
    unit_number: values.unit_number,
    type: values.type,
    building_name: values.building_name || null,
    floor: values.floor || null,
    area_m2: number(values.area_m2),
    participation_share: number(values.participation_share),
    maintenance_fee: number(values.maintenance_fee),
    parking_spots: values.parking_spots || null,
    storage_rooms: values.storage_rooms || null,
    notes: values.notes || null,
  }
}

export const RESIDENT_TYPES = ['owner', 'tenant', 'occupant', 'guest_resident'] as const

/** The resident drawer (mockup 12c): an existing person or a new one, plus the relation. */
export const memberSchema = z
  .object({
    mode: z.enum(['existing', 'new']),
    resident_id: z.string(),
    first_name: z.string().trim().max(255),
    last_name: z.string().trim().max(255),
    email: z.string().trim().email('validation.emailInvalid').or(z.literal('')),
    phone: z.string().trim().max(255, 'validation.phoneTooLong'),
    resident_type: z.enum(RESIDENT_TYPES),
    is_primary_contact: z.boolean(),
    invite: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === 'existing' && !values.resident_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.personRequired', path: ['resident_id'] })
    }
    if (values.mode === 'new') {
      if (!values.first_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.firstNameRequired', path: ['first_name'] })
      if (!values.last_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.lastNameRequired', path: ['last_name'] })
      if (values.invite && !values.email) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.emailRequiredForInvite', path: ['email'] })
    }
  })

export type MemberFormValues = z.infer<typeof memberSchema>

export type MembershipPayload = {
  unit_id: string
  resident_type: MemberFormValues['resident_type']
  is_primary_contact: boolean
}

export const VEHICLE_TYPES = ['car', 'motorcycle', 'bicycle', 'other'] as const

/** The vehicle drawer (mockup 12d). */
export const vehicleFormSchema = z.object({
  plate: z.string().trim().max(255),
  vehicle_type: z.enum(VEHICLE_TYPES),
  make: z.string().trim().max(255),
  model: z.string().trim().max(255),
  color: z.string().trim().max(255),
  notes: z.string().trim().max(1000),
})

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

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
