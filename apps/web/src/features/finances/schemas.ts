import { z } from 'zod'
import type { MovementsSearch } from './api'

export const FINANCE_CHIPS = ['income', 'expense', 'pending', 'paid', 'deposits', 'refunded'] as const

export type FinanceChip = (typeof FINANCE_CHIPS)[number]

/**
 * URL contract for /admin/finances. `month` (YYYY-MM) defaults to the
 * current one in the location's timezone; `chip` is the mockup's filter
 * row, translated into API params by chipParams().
 */
export const financesSearchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  chip: z.enum(FINANCE_CHIPS).optional().catch(undefined),
  search: z.string().catch(''),
  /** Comma-separated category set from the Filtros popover. */
  category: z.string().catch(''),
  sort: z.string().catch(''),
  /** Opens the drawer for this row; deep-linked from a reservation. */
  movement: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
})

export type FinancesSearchValues = z.infer<typeof financesSearchSchema>

export function chipParams(chip: FinanceChip | undefined): Pick<MovementsSearch, 'direction' | 'status' | 'category'> {
  switch (chip) {
    case 'income':
      return { direction: 'income' }
    case 'expense':
      return { direction: 'expense' }
    case 'pending':
      return { status: 'pending' }
    case 'paid':
      return { status: 'paid' }
    case 'deposits':
      return { category: 'reservation_deposit' }
    case 'refunded':
      return { status: 'refunded' }
    default:
      return {}
  }
}

/** Closed, direction-scoped list (mockup 10, "Categorías v2"). */
export const INCOME_CATEGORIES = [
  'reservation_fee',
  'reservation_deposit',
  'maintenance_dues',
  'fine',
  'other_income',
] as const
export const EXPENSE_CATEGORIES = [
  'water',
  'electricity',
  'gas',
  'telecom',
  'cleaning',
  'maintenance',
  'security',
  'staff',
  'supplies',
  'gardening',
  'insurance_taxes',
  'administration',
  'other_expense',
] as const

/**
 * The Registrar movimiento drawer. Shape only — the API validates the
 * initial status against the category and surfaces it as a field error.
 */
export const movementFormSchema = z.object({
  direction: z.enum(['income', 'expense']),
  category: z.string().min(1, 'validation.categoryRequired'),
  amount: z
    .union([z.number().int().positive(), z.literal('')])
    // Not written as a type guard on purpose: the form keeps '' while empty.
    .refine((value) => Number(value) > 0, 'validation.amountRequired'),
  concept: z.string().trim().min(1, 'validation.conceptRequired').max(120, 'validation.conceptTooLong'),
  detail: z.string().max(255, 'validation.detailTooLong'),
  counterparty: z.string().max(120, 'validation.counterpartyTooLong'),
  unit_id: z.string(),
  occurred_on: z.string().min(1, 'validation.dateRequired'),
  due_on: z.string(),
  status: z.enum(['pending', 'paid', 'held']),
  note: z.string().max(1000, 'validation.noteTooLong'),
})

export type MovementFormValues = z.infer<typeof movementFormSchema>
