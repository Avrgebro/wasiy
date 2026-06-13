import { z } from 'zod'

export const residentSchema = z.object({
  email: z.string().trim().email('validation.emailInvalid').or(z.literal('')),
  first_name: z.string().trim().min(1, 'validation.firstNameRequired').max(255),
  last_name: z.string().trim().min(1, 'validation.lastNameRequired').max(255),
  phone: z.string().trim().max(255, 'validation.phoneTooLong').or(z.literal('')),
  resident_type: z.enum(['owner', 'tenant', 'occupant', 'guest_resident']),
  status: z.enum(['active', 'inactive']),
  unit_id: z.string().optional(),
})

export type ResidentFormValues = z.infer<typeof residentSchema>
