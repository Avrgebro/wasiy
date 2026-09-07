import { NumberInput, PasswordInput, Select, TextInput } from '@mantine/core'
import type { NumberInputProps, PasswordInputProps, SelectProps, TextInputProps } from '@mantine/core'
import type { ReactNode } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { fieldErrorMessage } from '../../lib/errors'

type FormFieldProps<T extends FieldValues> = {
  autoComplete?: string
  control: Control<T>
  description?: ReactNode
  label: ReactNode
  leftSection?: ReactNode
  name: Path<T>
  placeholder?: string
  /** Marks the label with the required asterisk; validation itself lives in the schema. */
  withAsterisk?: boolean
}

/**
 * react-hook-form-wired Mantine inputs with translated field errors —
 * schema messages are i18n keys, server messages pass through as-is.
 */
export function FormTextInput<T extends FieldValues>({
  autoComplete,
  control,
  description,
  label,
  leftSection,
  name,
  placeholder,
  styles,
  type,
  withAsterisk,
}: FormFieldProps<T> & { styles?: TextInputProps['styles']; type?: TextInputProps['type'] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextInput
          {...field}
          autoComplete={autoComplete}
          description={description}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          leftSection={leftSection}
          placeholder={placeholder}
          styles={styles}
          type={type}
          withAsterisk={withAsterisk}
        />
      )}
    />
  )
}

/** Field value is a number, or '' while empty; the schema decides what that means. */
export function FormNumberInput<T extends FieldValues>({
  control,
  description,
  label,
  name,
  placeholder,
  styles,
  withAsterisk,
  ...rest
}: FormFieldProps<T> & Pick<NumberInputProps, 'allowDecimal' | 'allowNegative' | 'inputMode' | 'max' | 'maw' | 'min' | 'step' | 'styles' | 'w'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberInput
          {...rest}
          description={description}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          name={field.name}
          onBlur={field.onBlur}
          onChange={field.onChange}
          placeholder={placeholder}
          ref={field.ref}
          styles={styles}
          value={field.value}
          withAsterisk={withAsterisk}
        />
      )}
    />
  )
}

export function FormSelect<T extends FieldValues>({
  control,
  data,
  description,
  label,
  leftSection,
  name,
  placeholder,
  styles,
  withAsterisk,
  ...rest
}: FormFieldProps<T> & Pick<SelectProps, 'allowDeselect' | 'comboboxProps' | 'data' | 'searchable' | 'styles'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          {...rest}
          data={data}
          description={description}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          leftSection={leftSection}
          name={field.name}
          onBlur={field.onBlur}
          onChange={field.onChange}
          placeholder={placeholder}
          ref={field.ref}
          styles={styles}
          value={field.value}
          withAsterisk={withAsterisk}
        />
      )}
    />
  )
}

export function FormPasswordInput<T extends FieldValues>({
  autoComplete,
  control,
  label,
  leftSection,
  name,
  styles,
}: FormFieldProps<T> & { styles?: PasswordInputProps['styles'] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <PasswordInput
          {...field}
          autoComplete={autoComplete}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          leftSection={leftSection}
          styles={styles}
        />
      )}
    />
  )
}
