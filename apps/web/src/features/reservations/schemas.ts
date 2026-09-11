import { z } from 'zod'

/**
 * The reservations page URL: `date` is the day the board shows, defaulting
 * to today; `reservation` opens the detail drawer (deep link from Finanzas).
 */
export const reservationsSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  reservation: z.string().optional().catch(undefined),
})

export type ReservationsSearchValues = z.infer<typeof reservationsSearchSchema>

/**
 * The Nueva reserva drawer. Shape only — window, capacity, and policy rules
 * live in the API's ValidateReservationSlot, surfaced as field errors.
 */
export const reservationFormSchema = z
  .object({
    amenity_id: z.string().min(1, 'validation.amenityRequired'),
    unit_id: z.string().min(1, 'validation.unitRequired'),
    resident_id: z.string(),
    date: z.string().min(1, 'validation.dateRequired'),
    start: z.string().min(1, 'validation.startRequired'),
    end: z.string().min(1, 'validation.endRequired'),
  })
  .superRefine((values, ctx) => {
    if (values.start && values.end && values.end <= values.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.endAfterStart',
        path: ['end'],
      })
    }
  })

export type ReservationFormValues = z.infer<typeof reservationFormSchema>
