import { describe, expect, it } from 'vitest'
import { i18next } from '../i18n'
import { fieldErrorMessage } from './errors'
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
