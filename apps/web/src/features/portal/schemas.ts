import { z } from 'zod'

export const portalPhoneSchema = z.object({
  phone: z.string().trim().max(255, 'validation.phoneTooLong').nullable(),
})

export type PortalPhoneFormValues = z.infer<typeof portalPhoneSchema>
