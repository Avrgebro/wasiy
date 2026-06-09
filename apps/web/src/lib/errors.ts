import { ApiError } from '../app/api-client'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Ocurrió un error inesperado.'
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
