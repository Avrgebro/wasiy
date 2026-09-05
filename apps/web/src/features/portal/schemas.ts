import { z } from 'zod'

export const portalPhoneSchema = z.object({
  phone: z.string().trim().max(255, 'validation.phoneTooLong').nullable(),
})

export type PortalPhoneFormValues = z.infer<typeof portalPhoneSchema>

/** Pre-registration form (Portal 01c). Date is Y-m-d; time is H:i or empty. */
export const preRegisterSchema = z.object({
  visitor_name: z.string().trim().min(1, 'validation.visitorNameRequired').max(255),
  document: z.string().trim().max(64),
  when: z.enum(['today', 'other']),
  expected_on: z.string(),
  expected_time: z.string(),
  notes: z.string().trim().max(1000, 'validation.noteTooLong'),
})

export type PreRegisterFormValues = z.infer<typeof preRegisterSchema>
