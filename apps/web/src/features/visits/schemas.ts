import { z } from 'zod'

export const VISIT_CHIPS = ['inside', 'today', 'all'] as const
export type VisitChip = (typeof VISIT_CHIPS)[number]
export const VISIT_CONFIRMATIONS = ['none', 'intercom', 'phone', 'management'] as const

/** URL contract for /admin/visitors (mockup 16). Default chip: Dentro. */
export const visitsSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  search: z.string().catch(''),
  chip: z.enum(VISIT_CHIPS).catch('inside'),
  confirmation: z.string().catch(''),
})

export type VisitsSearchValues = z.infer<typeof visitsSearchSchema>

/** The register drawer (mockup 16b): name and unit are enough; the rest never blocks. */
export const registerVisitSchema = z.object({
  visitor_name: z.string().trim().min(1, 'validation.visitorNameRequired').max(255),
  document: z.string().trim().max(64),
  phone: z.string().trim().max(64),
  unit_id: z.string().min(1, 'validation.unitRequired'),
  resident_id: z.string(),
  confirmation: z.enum(VISIT_CONFIRMATIONS),
  notes: z.string().trim().max(1000, 'validation.noteTooLong'),
})

export type RegisterVisitValues = z.infer<typeof registerVisitSchema>
