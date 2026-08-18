import { PasswordInput, TextInput } from '@mantine/core'
import type { PasswordInputProps, TextInputProps } from '@mantine/core'
import type { ReactNode } from 'react'
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { fieldErrorMessage } from '../../lib/errors'

type FormFieldProps<T extends FieldValues> = {
  autoComplete?: string
  control: Control<T>
  label: ReactNode
  leftSection?: ReactNode
  name: Path<T>
  placeholder?: string
}

/**
 * react-hook-form-wired Mantine inputs with translated field errors —
 * schema messages are i18n keys, server messages pass through as-is.
 */
export function FormTextInput<T extends FieldValues>({
  autoComplete,
  control,
  label,
  leftSection,
  name,
  placeholder,
  styles,
}: FormFieldProps<T> & { styles?: TextInputProps['styles'] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextInput
          {...field}
          autoComplete={autoComplete}
          error={fieldErrorMessage(fieldState.error)}
          label={label}
          leftSection={leftSection}
          placeholder={placeholder}
          styles={styles}
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
