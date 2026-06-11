import { ApiError } from '../app/api-client'
import { i18next } from '../i18n'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

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
