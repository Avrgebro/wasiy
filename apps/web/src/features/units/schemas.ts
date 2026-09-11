import { z } from 'zod'
import type { UnitsSearch } from './api'

const optionalNumber = z.union([z.number(), z.literal('')])

/** The unit drawer (mockup 12b): two sections, Identificación and Cuota y participación. */
export const unitSchema = z.object({
  unit_number: z.string().trim().min(1, 'validation.unitRequired').max(255),
  type: z.enum(['apartment', 'house', 'commercial', 'office']),
  /** Required by the API once the location has two or more buildings. */
  building_id: z.string(),
  floor: z.string().trim().max(255),
  participation_share: optionalNumber.refine((value) => value === '' || Number(value) <= 100, 'validation.shareTooHigh'),
  /** Integer cents; null while empty. */
  maintenance_fee_minor: z.number().int().nullable(),
  parking_spots: z.array(z.string().trim().min(1).max(30)).max(20),
  storage_rooms: z.array(z.string().trim().min(1).max(30)).max(20),
  notes: z.string().trim().max(5000),
})

export type UnitFormValues = z.infer<typeof unitSchema>

export type UnitPayload = {
  unit_number: string
  type: UnitFormValues['type']
  building_id: string | null
  floor: string | null
  participation_share: number | null
  maintenance_fee_minor: number | null
  parking_spots: string | null
  storage_rooms: string | null
  notes: string | null
}

export function toUnitPayload(values: UnitFormValues): UnitPayload {
  const number = (value: number | '') => (value === '' ? null : Number(value))

  return {
    unit_number: values.unit_number,
    type: values.type,
    building_id: values.building_id || null,
    floor: values.floor || null,
    participation_share: number(values.participation_share),
    maintenance_fee_minor: values.maintenance_fee_minor,
    // Labels travel as the comma-joined string the API stores.
    parking_spots: values.parking_spots.length > 0 ? values.parking_spots.join(', ') : null,
    storage_rooms: values.storage_rooms.length > 0 ? values.storage_rooms.join(', ') : null,
    notes: values.notes || null,
  }
}

/** The resident drawer (mockup 12c): an existing person or a new one, plus the relation. */
export const memberSchema = z
  .object({
    mode: z.enum(['existing', 'new']),
    resident_id: z.string(),
    first_name: z.string().trim().max(255),
    last_name: z.string().trim().max(255),
    email: z.string().trim().email('validation.emailInvalid').or(z.literal('')),
    phone: z.string().trim().max(255, 'validation.phoneTooLong'),
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
    }
  })

export type MemberFormValues = z.infer<typeof memberSchema>

export type MembershipPayload = {
  unit_id: string
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

/**
 * The directory has no quick-view row (decided 2026-09-05): nothing on it
 * changes hour to hour. The data gaps an admin fixes live behind Filtros as
 * "Atención": no residents registered, no primary contact, residents but no
 * one on the portal, and no monthly fee defined (those units are skipped
 * when the month's dues are generated).
 */
export const UNIT_ATTENTION = ['no_residents', 'no_contact', 'no_portal', 'no_fee'] as const
export type UnitAttention = (typeof UNIT_ATTENTION)[number]

/**
 * URL contract for /admin/units (mockup 11). `type`, `status` and
 * `attention` live behind Filtros; `search` reaches unit, building,
 * resident names and plates on the server.
 */
export const unitsSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  search: z.string().catch(''),
  sort: z.string().catch(''),
  type: z.string().catch(''),
  status: z.string().catch(''),
  attention: z.enum(UNIT_ATTENTION).optional().catch(undefined),
})

export type UnitsSearchValues = z.infer<typeof unitsSearchSchema>

export function attentionParams(attention: UnitAttention | undefined): Pick<UnitsSearch, 'occupancy' | 'portal' | 'fee'> {
  switch (attention) {
    case 'no_residents':
      return { occupancy: 'vacant' }
    case 'no_contact':
      return { occupancy: 'attention' }
    case 'no_portal':
      return { portal: 'none' }
    case 'no_fee':
      return { fee: 'missing' }
    default:
      return {}
  }
}
