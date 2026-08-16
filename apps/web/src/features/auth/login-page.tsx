import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button } from '@mantine/core'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getDefaultAuthenticatedRoute } from './access'
import { getSafeRedirectPath } from './guards'
import { useLogin } from './hooks'
import { loginSchema, type LoginFormValues } from './schemas'
import { FormPasswordInput, FormTextInput } from '../../components/ui/form-fields'
import { submitHandlingServerErrors } from '../../lib/errors'

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
    await submitHandlingServerErrors(form, async () => {
      const session = await loginMutation.mutateAsync(values)

      // A non-authenticated session right after login (e.g. a deactivated
      // user) is routed by the index guard.
      await router.navigate({
        to:
          getSafeRedirectPath(search.redirect) ??
          (session.status === 'authenticated'
            ? getDefaultAuthenticatedRoute(session.me)
            : '/'),
      })
    })
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--mantine-color-body)] px-4">
      <form
        className="w-full max-w-sm rounded-md border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
          {t('auth.loginTitle')}
        </h1>
        <div className="mt-5 grid gap-4">
          {rootError ? (
            <Alert color="red" title={t('auth.loginFailed')}>
              {rootError}
            </Alert>
          ) : null}
          <FormTextInput
            autoComplete="email"
            control={form.control}
            label={t('auth.email')}
            name="email"
            placeholder="manager@wasiy.test"
          />
          <FormPasswordInput
            autoComplete="current-password"
            control={form.control}
            label={t('auth.password')}
            name="password"
          />
          <Button loading={loginMutation.isPending} type="submit">
            {t('auth.login')}
          </Button>
        </div>
      </form>
    </main>
  )
}
