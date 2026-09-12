import { z } from 'zod'

/**
 * The reservations page URL: `date` anchors the week the list shows,
 * defaulting to today; `status` is the chip (not the raw API status),
 * `amenity_id` and `search` filter the week client-side; `reservation`
 * opens the detail drawer (deep link from Finanzas).
 */
export const reservationsSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  status: z.enum(['pending', 'approved', 'completed']).optional().catch(undefined),
  amenity_id: z.string().optional().catch(undefined),
  search: z.string().trim().optional().catch(undefined),
  reservation: z.string().optional().catch(undefined),
})

export type ReservationsSearchValues = z.infer<typeof reservationsSearchSchema>

/**
 * The Nueva reserva drawer. Shape only — open days, horizon and capacity
 * live in the API's ValidateReservationDay, surfaced as field errors.
 */
export const reservationFormSchema = z.object({
  amenity_id: z.string().min(1, 'validation.amenityRequired'),
  unit_id: z.string().min(1, 'validation.unitRequired'),
  resident_id: z.string(),
  date: z.string().min(1, 'validation.dateRequired'),
})

export type ReservationFormValues = z.infer<typeof reservationFormSchema>
