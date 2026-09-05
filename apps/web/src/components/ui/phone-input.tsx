import { Combobox, InputWrapperContext, TextInput, UnstyledButton, useCombobox } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import type { CountryCode } from 'libphonenumber-js/min'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { fieldErrorMessage } from '../../lib/errors'
import { asCountryCode, countryFlag, countryOptions, formatAsYouType, fromE164, toE164 } from '../../lib/phone'
import { getCountryCallingCode } from 'libphonenumber-js/min'

/**
 * A phone field: Mantine TextInput with the country picker in its left
 * section. Value in and out is E.164 ("+51987654321"), what the API stores.
 * The country defaults to the location's, so a Lima desk types
 * "987 654 321" and never sees +51.
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
  const fallback = asCountryCode(defaultCountry)
  const [country, setCountry] = useState(() => fromE164(value, fallback).country)
  const [national, setNational] = useState(() => fromE164(value, fallback).national)
  const lastEmitted = useRef(value)

  // A value arriving from outside (form reset, record loaded) re-seeds both
  // parts; our own emissions are skipped so typing is never reformatted.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const next = fromE164(value, fallback)
      setCountry(next.country)
      setNational(next.national)
      lastEmitted.current = value
    }
  }, [value, fallback])

  function emit(nextNational: string, nextCountry: CountryCode) {
    const e164 = toE164(nextNational, nextCountry)
    lastEmitted.current = e164
    onChange(e164)
  }

  return (
    <TextInput
      error={error}
      inputMode="tel"
      label={label}
      leftSection={
        <CountryPicker
          value={country}
          onChange={(next) => {
            setCountry(next)
            emit(national, next)
          }}
        />
      }
      leftSectionPointerEvents="all"
      leftSectionWidth={80}
      placeholder={placeholder}
      required={required}
      value={national}
      onChange={(event) => {
        const typed = event.currentTarget.value
        // Format only while appending; deleting through a space is otherwise impossible.
        const formatted = typed.length > national.length ? formatAsYouType(typed, country) : typed
        setNational(formatted)
        emit(formatted, country)
      }}
    />
  )
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Mantine inputs read their id from the enclosing Input.Wrapper context, so
 * a search box rendered inside the phone field's left section would share
 * the phone's id and take its label. The picker resets that context.
 */
const NO_WRAPPER = { offsetTop: false, offsetBottom: false, describedBy: undefined, inputId: undefined, labelId: undefined, getStyles: null }

/** Flag and calling code; with more than one supported country, click for a searchable list. */
function CountryPicker({ value, onChange }: { value: CountryCode; onChange: (country: CountryCode) => void }) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption()
      setSearch('')
    },
  })

  const options = countryOptions()
  const callingCode = getCountryCallingCode(value)
  const needle = normalize(search.trim())
  const shown = needle
    ? options.filter(
        (option) =>
          normalize(option.name).includes(needle) ||
          option.callingCode.startsWith(needle.replace('+', '')) ||
          option.value.toLowerCase() === needle,
      )
    : options

  return (
    <InputWrapperContext.Provider value={NO_WRAPPER}>
      <Combobox
        position="bottom-start"
        store={combobox}
        width={300}
        withinPortal
        onOptionSubmit={(code) => {
          onChange(asCountryCode(code))
          combobox.closeDropdown()
        }}
      >
      <Combobox.Target>
        <UnstyledButton
          aria-expanded={options.length > 1 ? combobox.dropdownOpened : undefined}
          aria-haspopup={options.length > 1 ? 'listbox' : undefined}
          aria-label={t('phone.country')}
          className={`flex h-full w-full items-center justify-center gap-1 rounded-l-[var(--input-radius)] text-sm text-[var(--mantine-color-text)] ${options.length > 1 ? 'hover:bg-[var(--wa-hover)]' : 'cursor-default'}`}
          disabled={options.length <= 1}
          type="button"
          onClick={() => combobox.toggleDropdown()}
        >
          <span aria-hidden>{countryFlag(value)}</span>
          <span className="font-mono text-xs">+{callingCode}</span>
          {options.length > 1 ? <AltArrowDown aria-hidden size={12} /> : null}
        </UnstyledButton>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          placeholder={t('phone.searchCountry')}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Combobox.Options mah={260} style={{ overflowX: 'hidden', overflowY: 'auto' }}>
          {shown.length === 0 ? <Combobox.Empty>{t('phone.noCountry')}</Combobox.Empty> : null}
          {shown.map((option) => (
            <Combobox.Option key={option.value} active={option.value === value} value={option.value}>
              <span className="flex w-full min-w-0 items-center gap-2 text-sm">
                <span aria-hidden className="shrink-0">
                  {countryFlag(option.value)}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                <span className="shrink-0 font-mono text-xs text-[var(--mantine-color-dimmed)]">+{option.callingCode}</span>
              </span>
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
      </Combobox>
    </InputWrapperContext.Provider>
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
