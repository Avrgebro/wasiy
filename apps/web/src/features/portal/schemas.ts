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

/** Agregar persona (Portal 04c). Phone and email are optional; the type is one of the three portal kinds. */
export const householdMemberSchema = z.object({
  first_name: z.string().trim().min(1, 'validation.firstNameRequired').max(120),
  last_name: z.string().trim().min(1, 'validation.lastNameRequired').max(120),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(''), z.string().trim().email('validation.emailInvalid').max(255)]),
  resident_type: z.enum(['owner', 'tenant', 'occupant']),
})

export type HouseholdMemberFormValues = z.infer<typeof householdMemberSchema>

/** Vehículo (Portal 04e). The plate is the only required field. */
export const portalVehicleSchema = z.object({
  plate: z.string().trim().min(1, 'validation.plateRequired').max(20),
  make: z.string().trim().max(60),
  model: z.string().trim().max(60),
  color: z.string().trim().max(40),
})

export type PortalVehicleFormValues = z.infer<typeof portalVehicleSchema>

/** Contraseña (Portal 04g). */
export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'validation.currentPasswordRequired'),
    password: z.string().min(8, 'validation.passwordMin'),
    password_confirmation: z.string(),
  })
  .refine((values) => values.password === values.password_confirmation, { message: 'validation.passwordMismatch', path: ['password_confirmation'] })

export type PasswordFormValues = z.infer<typeof passwordSchema>
