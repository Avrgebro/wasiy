import { z } from 'zod'

/**
 * URL contract for the locations list page: pagination plus the three
 * filters the API accepts.
 */
export const locationsSearchSchema = z.object({
  // All optional so typed <Link to="/admin/locations"> needs no search
  // prop; the API applies the same defaults these catches imply.
  page: z.coerce.number().int().positive().optional().catch(undefined),
  per_page: z.coerce.number().int().positive().max(100).optional().catch(undefined),
  search: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
})

export type LocationsSearchValues = z.infer<typeof locationsSearchSchema>

export const locationTypeValues = [
  'multifamily_building',
  'condominium',
  'residential_community',
  'other',
] as const

/**
 * Mirrors the API's required set — name, type, address line 1, and city are
 * the fields 06b marks with an asterisk. Everything else is optional and
 * sent as null when blank so the API stores absence, not empty strings.
 */
export const locationFormSchema = z.object({
  name: z.string().trim().min(1, 'validation.nameRequired'),
  type: z.enum(locationTypeValues, { message: 'validation.typeRequired' }),
  timezone: z.string().min(1),
  address_line1: z.string().trim().min(1, 'validation.addressLine1Required'),
  address_line2: z.string(),
  district: z.string(),
  city: z.string().trim().min(1, 'validation.cityRequired'),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
  phone: z.string(),
  contact_email: z.string().email('validation.emailInvalid').or(z.literal('')),
  access_notes: z.string(),
})

export type LocationFormValues = z.infer<typeof locationFormSchema>

export const locationDetailTabs = ['info', 'amenities', 'staff', 'settings'] as const

export type LocationDetailTab = (typeof locationDetailTabs)[number]

/**
 * The active tab lives in the URL so a tab is linkable and survives reload.
 */
export const locationDetailSearchSchema = z.object({
  tab: z.enum(locationDetailTabs).catch('info'),
})
