import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, PasswordInput, TextInput } from '@mantine/core'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getDefaultAuthenticatedRoute } from './access'
import { getSafeRedirectPath } from './guards'
import { useLogin } from './hooks'
import { loginSchema, type LoginFormValues } from './schemas'
import {
  applyLaravelValidationErrors,
  getErrorMessage,
} from '../../lib/errors'

const loginRouteApi = getRouteApi('/login')

export function LoginPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const search = loginRouteApi.useSearch()
  const loginMutation = useLogin()
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(loginSchema),
  })

  const rootError = form.formState.errors.root?.message

  async function handleSubmit(values: LoginFormValues) {
    try {
      const me = await loginMutation.mutateAsync(values)

      await router.navigate({
        to:
          getSafeRedirectPath(search.redirect) ??
          getDefaultAuthenticatedRoute(me),
      })
    } catch (error) {
      if (!applyLaravelValidationErrors<LoginFormValues>(error, form.setError)) {
        form.setError('root', {
          message: getErrorMessage(error),
          type: 'server',
        })
      }
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4">
      <form
        className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--card)] p-5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('auth.loginTitle')}
        </h1>
        <div className="mt-5 grid gap-4">
          {rootError ? (
            <Alert color="red" title={t('auth.loginFailed')}>
              {rootError}
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                autoComplete="email"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message)
                    : undefined
                }
                label={t('auth.email')}
                placeholder="manager@wasiy.test"
              />
            )}
          />
          <Controller
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <PasswordInput
                {...field}
                autoComplete="current-password"
                error={
                  fieldState.error?.message
                    ? t(fieldState.error.message)
                    : undefined
                }
                label={t('auth.password')}
              />
            )}
          />
          <Button loading={loginMutation.isPending} type="submit">
            {t('auth.login')}
          </Button>
        </div>
      </form>
    </main>
  )
}
