import { z } from 'zod'

export const unitSchema = z.object({
  building_name: z.string().trim().max(255).nullable(),
  floor: z.string().trim().max(255).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  status: z.enum(['active', 'inactive']),
  unit_number: z.string().trim().min(1, 'validation.unitRequired').max(255),
})

export type UnitFormValues = z.infer<typeof unitSchema>
