import { Combobox, ScrollArea, TextInput, UnstyledButton, useCombobox } from '@mantine/core'
import { AltArrowDown } from '@solar-icons/react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { fieldErrorMessage } from '../../lib/errors'
import { asCountryCode, countryFlag, countryOptions, formatAsYouType, fromE164, toE164 } from '../../lib/phone'
import type { CountryCode } from 'libphonenumber-js/min'

/**
 * One text input whose left section is the country: a flag-and-code button
 * that opens a searchable list. The value in and out is E.164
 * ("+51987654321"), which is what the API stores; the country defaults to
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

  function emit(nextNational: string, nextCountry: CountryCode) {
    const e164 = toE164(nextNational, nextCountry)
    lastEmitted.current = e164
    onChange(e164)
  }

  return (
    <CountryPicker
      value={country}
      onChange={(code) => {
        setCountry(code)
        emit(national, code)
      }}
    >
      {(trigger) => (
        <TextInput
          error={error}
          inputMode="tel"
          label={label}
          leftSection={trigger}
          leftSectionPointerEvents="all"
          leftSectionWidth={92}
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
      )}
    </CountryPicker>
  )
}

/**
 * The flag + calling code trigger and its searchable dropdown. The trigger is
 * handed to the input's left section through the render prop while the
 * dropdown stays out here: inside the TextInput's wrapper it would inherit
 * the field's id and steal its label.
 */
function CountryPicker({
  children,
  value,
  onChange,
}: {
  children: (trigger: ReactNode) => ReactNode
  value: CountryCode
  onChange: (code: CountryCode) => void
}) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption()
      setSearch('')
    },
  })
  const options = countryOptions()
  const current = options.find((option) => option.value === value)
  const needle = search.trim().toLowerCase()
  const shown = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle) || option.callingCode.startsWith(needle.replace('+', '')) || option.value.toLowerCase() === needle)
    : options

  return (
    <Combobox
      store={combobox}
      width={300}
      position="bottom-start"
      withinPortal
      onOptionSubmit={(code) => {
        onChange(asCountryCode(code))
        combobox.closeDropdown()
      }}
    >
      {children(
        <Combobox.Target>
          <UnstyledButton
          aria-expanded={combobox.dropdownOpened}
          aria-haspopup="listbox"
          aria-label={t('phone.country')}
          className="flex h-full w-full items-center justify-center gap-1 rounded-l-[inherit] border-r border-[var(--mantine-color-default-border)] pl-2.5 pr-1.5 text-sm text-[var(--mantine-color-text)] hover:bg-[var(--wa-hover)]"
          type="button"
          onClick={() => combobox.toggleDropdown()}
        >
            <span aria-hidden>{countryFlag(value)}</span>
            <span className="font-mono text-xs">+{current?.callingCode ?? ''}</span>
            <AltArrowDown aria-hidden size={12} />
          </UnstyledButton>
        </Combobox.Target>,
      )}

      <Combobox.Dropdown>
        <Combobox.Search placeholder={t('phone.searchCountry')} value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
        <Combobox.Options>
          <ScrollArea.Autosize mah={260} type="scroll">
            {shown.length === 0 ? <Combobox.Empty>{t('phone.noCountry')}</Combobox.Empty> : null}
            {shown.map((option) => (
              <Combobox.Option key={option.value} active={option.value === value} value={option.value}>
                <span className="flex items-center gap-2 text-sm">
                  <span aria-hidden>{countryFlag(option.value)}</span>
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  <span className="font-mono text-xs text-[var(--mantine-color-dimmed)]">+{option.callingCode}</span>
                </span>
              </Combobox.Option>
            ))}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
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
