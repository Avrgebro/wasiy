import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../app/api-client'
import { i18next } from '../i18n'
import { applyLaravelValidationErrors, fieldErrorMessage } from './errors'
import type { FieldError } from 'react-hook-form'

describe('fieldErrorMessage', () => {
  it('translates schema messages that are i18n keys', () => {
    const error: FieldError = { message: 'validation.firstNameRequired', type: 'min' }

    expect(fieldErrorMessage(error)).toBe(i18next.t('validation.firstNameRequired'))
    expect(fieldErrorMessage(error)).not.toBe('validation.firstNameRequired')
  })

  it('passes already-localized server messages through unchanged', () => {
    const error: FieldError = { message: 'La placa ya existe.', type: 'server' }

    expect(fieldErrorMessage(error)).toBe('La placa ya existe.')
  })

  it('returns undefined when there is no error', () => {
    expect(fieldErrorMessage(undefined)).toBeUndefined()
  })
})

describe('applyLaravelValidationErrors with known fields', () => {
  function makeApiError(errors: Record<string, string[]>) {
    return new ApiError('The given data was invalid.', 422, errors)
  }

  it('routes matched fields and reports a match', () => {
    const setError = vi.fn()
    const error = makeApiError({ email: ['Correo invalido.'] })

    expect(applyLaravelValidationErrors(error, setError, ['email', 'password'])).toBe(true)
    expect(setError).toHaveBeenCalledWith('email', {
      message: 'Correo invalido.',
      type: 'server',
    })
  })

  it('reports no match when every server field is unknown to the form', () => {
    const setError = vi.fn()
    const error = makeApiError({
      first_name: ['El nombre es obligatorio.'],
      'memberships.0.unit_id': ['La unidad no esta disponible.'],
    })

    expect(applyLaravelValidationErrors(error, setError, ['firstName', 'lastName'])).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it('keeps legacy behavior when known fields are not provided', () => {
    const setError = vi.fn()
    const error = makeApiError({ anything: ['Mensaje.'] })

    expect(applyLaravelValidationErrors(error, setError)).toBe(true)
  })
})
