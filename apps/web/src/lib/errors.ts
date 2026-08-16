import { ApiError } from '../app/api-client'
import { i18next } from '../i18n'
import type { FieldError, FieldValues, Path, UseFormSetError } from 'react-hook-form'

/**
 * Schema messages are i18n keys ('validation.firstNameRequired') and get
 * translated; server-set errors (type: 'server') are already-localized text
 * and pass through untouched — running them through i18next could mangle
 * messages containing ':' (namespace separator) or '{{' (interpolation).
 */
export function fieldErrorMessage(error: FieldError | undefined): string | undefined {
  if (!error?.message) {
    return undefined
  }

  return error.type === 'server' ? error.message : i18next.t(error.message)
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.message) {
      return error.message
    }

    return i18next.t(
      error.status === 0 ? 'errors.network' : 'errors.requestFailed',
    )
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return i18next.t('errors.unexpected')
}

/**
 * Runs a form submit, mapping Laravel 422 payloads onto their fields and
 * anything else — including 422s whose field names don't exist in the form
 * (naming-convention or nesting mismatches) — onto the form's root error.
 */
export async function submitHandlingServerErrors<T extends FieldValues>(
  form: { setError: UseFormSetError<T>; getValues: () => T },
  submit: () => Promise<unknown>,
) {
  try {
    await submit()
  } catch (error) {
    const knownFields = Object.keys(form.getValues())

    if (!applyLaravelValidationErrors<T>(error, form.setError, knownFields)) {
      form.setError('root', {
        message: getErrorMessage(error),
        type: 'server',
      })
    }
  }
}

/**
 * Returns true only when at least one server error landed on a real form
 * field; unmatched-only payloads return false so the caller can surface
 * them at the root instead of swallowing them.
 */
export function applyLaravelValidationErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields?: string[],
) {
  if (!(error instanceof ApiError) || !error.errors) {
    return false
  }

  let matched = false

  Object.entries(error.errors).forEach(([field, messages]) => {
    if (knownFields && !knownFields.includes(field)) {
      return
    }

    matched = true
    setError(field as Path<T>, {
      message: messages[0] ?? error.message,
      type: 'server',
    })
  })

  return knownFields ? matched : true
}
