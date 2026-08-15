import { ApiError } from '../app/api-client'
import { i18next } from '../i18n'
import type { FieldError, FieldValues, Path, UseFormSetError } from 'react-hook-form'

/**
 * Schema messages are i18n keys ('validation.firstNameRequired') while
 * server-set errors are already-localized text; i18next returns unknown
 * keys unchanged, so both come out display-ready.
 */
export function fieldErrorMessage(error: FieldError | undefined): string | undefined {
  return error?.message ? i18next.t(error.message) : undefined
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
 * anything else onto the form's root error.
 */
export async function submitHandlingServerErrors<T extends FieldValues>(
  form: { setError: UseFormSetError<T> },
  submit: () => Promise<unknown>,
) {
  try {
    await submit()
  } catch (error) {
    if (!applyLaravelValidationErrors<T>(error, form.setError)) {
      form.setError('root', {
        message: getErrorMessage(error),
        type: 'server',
      })
    }
  }
}

export function applyLaravelValidationErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
) {
  if (!(error instanceof ApiError) || !error.errors) {
    return false
  }

  Object.entries(error.errors).forEach(([field, messages]) => {
    setError(field as Path<T>, {
      message: messages[0] ?? error.message,
      type: 'server',
    })
  })

  return true
}
