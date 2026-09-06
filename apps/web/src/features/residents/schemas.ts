import { z } from 'zod'

/** URL contract for /admin/residents (mockup 15). */
export const residentsSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  search: z.string().catch(''),
  portal: z.string().catch(''),
  status: z.string().catch(''),
})

export type ResidentsSearchValues = z.infer<typeof residentsSearchSchema>

/** The person form (mockup 15b): names, optional phone, and the unit they enter through. */
export const personSchema = z.object({
  first_name: z.string().trim().min(1, 'validation.firstNameRequired').max(255),
  last_name: z.string().trim().min(1, 'validation.lastNameRequired').max(255),
  phone: z.string().trim().max(255, 'validation.phoneTooLong'),
  unit_id: z.string().min(1, 'validation.unitRequired'),
  is_primary_contact: z.boolean(),
})

export type PersonFormValues = z.infer<typeof personSchema>

export const inviteSchema = z.object({
  email: z.string().trim().email('validation.emailInvalid'),
})
