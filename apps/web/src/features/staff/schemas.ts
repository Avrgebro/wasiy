import { z } from 'zod'

/**
 * URL contract for the staff list page, mirroring registrySearchSchema plus
 * the two staff-specific filters the API accepts (role, location_id).
 */
export const staffSearchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  per_page: z.coerce.number().int().positive().max(100).catch(15),
  search: z.string().catch(''),
  role: z.string().catch(''),
  location_id: z.string().catch(''),
  status: z.string().catch(''),
})

export type StaffSearchValues = z.infer<typeof staffSearchSchema>

const locationAssignmentSchema = z.object({
  location_id: z.string().min(1, 'validation.locationRequired'),
  role: z.enum(['location_manager', 'front_desk']),
})

/**
 * Access types are mutually exclusive — account admin already implies every
 * location — so the form models them as a radio choice. The API enforces
 * the same rule. Location staff needs at least one assignment, and no
 * location can be assigned twice.
 */
export const staffAccessSchema = z
  .object({
    access_type: z.enum(['account_admin', 'location_staff']),
    location_assignments: z.array(locationAssignmentSchema),
  })
  .superRefine((values, ctx) => {
    if (values.access_type === 'location_staff' && values.location_assignments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.locationAssignmentsRequired',
        path: ['location_assignments'],
      })
    }

    const seen = new Set<string>()
    values.location_assignments.forEach((assignment, index) => {
      if (!assignment.location_id) {
        return
      }

      if (seen.has(assignment.location_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'validation.locationDuplicated',
          path: ['location_assignments', index, 'location_id'],
        })
      }

      seen.add(assignment.location_id)
    })
  })

export const staffInviteSchema = z
  .object({
    email: z.string().trim().email('validation.emailInvalid'),
    first_name: z.string().trim().min(1, 'validation.firstNameRequired').max(255),
    last_name: z.string().trim().min(1, 'validation.lastNameRequired').max(255),
  })
  .and(staffAccessSchema)

export type StaffAccessFormValues = z.infer<typeof staffAccessSchema>
export type StaffInviteFormValues = z.infer<typeof staffInviteSchema>
