import { Select, TextInput } from '@mantine/core'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { fieldErrorMessage } from '../../lib/errors'
import { asCountryCode, countryOptions, formatAsYouType, fromE164, toE164 } from '../../lib/phone'

/**
 * Country selector plus national number; the value in and out is E.164
 * ("+51987654321"), which is what the API stores. The country defaults to
 * the location's, so a Lima desk types "987 654 321" and never sees +51.
 */
export function PhoneInput({
  defaultCountry,
  error,
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  defaultCountry: string
  error?: ReactNode
  label: ReactNode
  onChange: (e164: string) => void
  placeholder?: string
  required?: boolean
  value: string
}) {
  const { t } = useTranslation('common')
  const fallback = asCountryCode(defaultCountry)
  const initial = fromE164(value, fallback)
  const [country, setCountry] = useState(initial.country)
  const [national, setNational] = useState(initial.national)
  const lastEmitted = useRef(value)

  // A form reset (or an initial value arriving later) re-seeds both parts;
  // our own emissions are ignored so typing is never reformatted mid-word.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const next = fromE164(value, fallback)
      setCountry(next.country)
      setNational(next.national)
      lastEmitted.current = value
    }
  }, [value, fallback])

  function emit(nextNational: string, nextCountry: typeof country) {
    const e164 = toE164(nextNational, nextCountry)
    lastEmitted.current = e164
    onChange(e164)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <Select
          allowDeselect={false}
          aria-label={t('phone.country')}
          className="w-44 shrink-0"
          comboboxProps={{ withinPortal: true, width: 320, position: 'bottom-start' }}
          data={countryOptions()}
          label={label}
          required={required}
          searchable
          value={country}
          onChange={(next) => {
            if (!next) return
            const code = asCountryCode(next)
            setCountry(code)
            emit(national, code)
          }}
        />
        <TextInput
          aria-label={t('phone.number')}
          className="min-w-0 flex-1"
          error={error ? true : undefined}
          inputMode="tel"
          placeholder={placeholder}
          value={national}
          onChange={(event) => {
            const typed = event.currentTarget.value
            // Format only while appending; deleting through a space is otherwise impossible.
            const formatted = typed.length > national.length ? formatAsYouType(typed, country) : typed
            setNational(formatted)
            emit(formatted, country)
          }}
        />
      </div>
      {error ? <p className="m-0 text-xs text-[var(--wa-error)]">{error}</p> : null}
    </div>
  )
}

export function FormPhoneInput<T extends FieldValues>({
  control,
  defaultCountry,
  label,
  name,
  placeholder,
  required,
}: {
  control: Control<T>
  defaultCountry: string
  label: ReactNode
  name: Path<T>
  placeholder?: string
  required?: boolean
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <PhoneInput
          defaultCountry={defaultCountry}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          placeholder={placeholder}
          required={required}
          value={(field.value as string | null) ?? ''}
          onChange={field.onChange}
        />
      )}
    />
  )
}
