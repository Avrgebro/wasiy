import { z } from 'zod'

/**
 * The single owner of the registry list-page URL contract: coercion,
 * defaults, and the per-page cap all live here. Routes pass the schema
 * straight to validateSearch, so pages receive already-normalized values.
 */
export const registrySearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  per_page: z.coerce.number().int().positive().max(100).catch(15),
  search: z.string().catch(''),
  sort: z.string().catch(''),
  status: z.string().catch(''),
})

export const vehicleRegistrySearchSchema = registrySearchSchema.extend({
  vehicle_type: z.string().catch(''),
})

export type RegistrySearchValues = z.infer<typeof registrySearchSchema>
