import { z } from 'zod'

export const PACKAGE_CHIPS = ['all', 'pending', 'delivered'] as const
export type PackageChip = (typeof PACKAGE_CHIPS)[number]

/** URL contract for /admin/packages (mockup 14). Default chip: En recepción. */
export const packagesSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  search: z.string().catch(''),
  chip: z.enum(PACKAGE_CHIPS).catch('pending'),
})

export type PackagesSearchValues = z.infer<typeof packagesSearchSchema>

/** The register drawer (mockup 14b): three fields. */
export const registerPackageSchema = z.object({
  unit_id: z.string().min(1, 'validation.unitRequired'),
  resident_id: z.string(),
  notes: z.string().trim().max(1000, 'validation.noteTooLong'),
})

export type RegisterPackageValues = z.infer<typeof registerPackageSchema>
