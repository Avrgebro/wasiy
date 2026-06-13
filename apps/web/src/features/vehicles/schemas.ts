import { z } from 'zod'

export const vehicleSchema = z.object({
  color: z.string().trim().max(255).nullable(),
  make: z.string().trim().max(255).nullable(),
  model: z.string().trim().max(255).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  plate: z.string().trim().max(255).nullable(),
  status: z.enum(['active', 'inactive']),
  unit_id: z.string().min(1, 'validation.unitRequired'),
  vehicle_type: z.enum(['car', 'motorcycle', 'bicycle', 'other']),
})

export type VehicleFormValues = z.infer<typeof vehicleSchema>
