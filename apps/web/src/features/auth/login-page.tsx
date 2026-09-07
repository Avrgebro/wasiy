import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRightIcon, GlobalIcon, LetterIcon, LockPasswordIcon, PasswordIcon } from '@solar-icons/react/linear'
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  Divider,
} from '@mantine/core'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { getDefaultAuthenticatedRoute } from './access'
import { getSafeRedirectPath } from './guards'
import { useLogin } from './hooks'
import { authFieldStyles } from './auth-field-styles'
import { loginSchema, type LoginFormValues } from './schemas'
import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'
import { FormPasswordInput, FormTextInput } from '../../components/ui/form-fields'
import { submitHandlingServerErrors } from '../../lib/errors'

const loginRouteApi = getRouteApi('/login')

/**
 * Oversized Wasiy mark as a background watermark. Same geometry as
 * WasiyLogo, with the amber dot inside the SVG so it stays locked to the
 * tubes at any size. The green sits between palette stops on purpose (a
 * subtle mid-tone over dark-8) and only ever renders on this dark panel.
 */
function BrandArtwork() {
  return (
    <svg
      aria-hidden="true"
      className="absolute -bottom-24 -right-24 size-[min(78vh,42vw)] max-w-none"
      fill="none"
      viewBox="0 0 48 48"
    >
      <path
        d="M8 12 v16 a8 8 0 0 0 16 0 v-16
          M24 12 v16 a8 8 0 0 0 16 0 v-16
          M40 28 v6 a2 2 0 0 1 -2 2 h-6"
        stroke="#16403F"
        strokeLinecap="round"
        strokeWidth="6.5"
      />
      <circle cx="32" cy="19" r="3.5" fill="#E0A438" opacity="0.9" />
    </svg>
  )
}

/**
 * Brand side of the split layout. Always dark (Mantine palette vars, not the
 * scheme-dependent semantic tokens) so the petroleum panel reads the same in
 * light and dark mode.
 */
function BrandPanel() {
  const { t } = useTranslation('common')

  return (
    <section className="relative hidden flex-col justify-between overflow-hidden bg-[var(--mantine-color-dark-8)] p-14 xl:flex">
      <BrandArtwork />

      <div className="relative flex items-center gap-2.5">
        <WasiyLogo className="shrink-0 text-[#F7F5F0]" size={32} />
        <span className="font-display text-2xl font-semibold tracking-tight text-[#F7F5F0]">
          Wasiy
        </span>
      </div>

      <div className="relative flex max-w-[460px] flex-col gap-[22px]">
        <h2 className="font-display text-pretty text-[2.625rem] font-semibold leading-[1.18] tracking-tight text-[#F7F5F0]">
          {t('auth.brandHeadline')}
        </h2>
        <p className="text-[16.5px] leading-[1.6] text-[var(--mantine-color-dark-2)]">
          {t('auth.brandSubtitle')}
        </p>
      </div>

      <div className="relative flex gap-3.5">
        <BrandStat label={t('auth.brandStatUnits')} value="1 240" />
        <BrandStat label={t('auth.brandStatBuildings')} value="37" />
      </div>
    </section>
  )
}

function BrandStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-surface border border-[var(--mantine-color-dark-4)] bg-[var(--mantine-color-dark-5)]/70 px-5 py-[18px] backdrop-blur-sm">
      {/* Constant petroleum panel: the accent stays at its dark value. */}
      <div className="font-display text-2xl font-semibold text-[var(--mantine-color-accent-5)]">
        {value}
      </div>
      <div className="mt-1 text-[13px] text-[var(--mantine-color-dark-2)]">
        {label}
      </div>
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const search = loginRouteApi.useSearch()
  const loginMutation = useLogin()
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
      remember: true,
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
    <main className="grid min-h-screen bg-[var(--mantine-color-body)] font-brand [--mantine-font-family:var(--font-brand)] xl:grid-cols-2">
      <BrandPanel />

      <section className="relative flex flex-col items-center justify-center px-6 py-20 xl:px-24">
        <div className="flex w-full max-w-[420px] flex-col gap-[26px]">
          <div className="flex items-center gap-2.5 xl:hidden">
            <WasiyLogo
              className="shrink-0 text-[var(--wa-brand-mark)]"
              size={28}
            />
            <span className="font-display text-xl font-semibold tracking-tight text-[var(--mantine-color-text)]">
              Wasiy
            </span>
          </div>

          <div>
            <h1 className="font-display text-[2rem] font-semibold tracking-tight text-[var(--mantine-color-text)]">
              {t('auth.welcomeBack')}
            </h1>
            <p className="mt-2 text-[15px] text-[var(--mantine-color-dimmed)]">
              {t('auth.welcomeBackSubtitle')}
            </p>
          </div>

          <form
            className="flex flex-col gap-[26px]"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <div className="flex flex-col gap-4">
              {rootError ? (
                <Alert color="error" title={t('auth.loginFailed')}>
                  {rootError}
                </Alert>
              ) : null}
              <FormTextInput
                autoComplete="email"
                control={form.control}
                label={t('auth.email')}
                leftSection={<LetterIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />}
                name="email"
                placeholder="maria.torres@wasiy.pe"
                styles={authFieldStyles}
              />
              <FormPasswordInput
                autoComplete="current-password"
                control={form.control}
                label={
                  <span className="flex items-baseline justify-between">
                    {t('auth.password')}
                    <Anchor component="button" fw={500} fz={12.5} type="button">
                      {t('auth.forgotPassword')}
                    </Anchor>
                  </span>
                }
                leftSection={<LockPasswordIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />}
                name="password"
                styles={authFieldStyles}
              />
              <Checkbox
                color="accent"
                label={t('auth.rememberMe')}
                {...form.register('remember')}
                radius={5}
                size="sm"
                styles={{
                  label: {
                    fontSize: 13.5,
                    color: 'var(--mantine-color-dimmed)',
                  },
                }}
              />
            </div>

            <div className="flex flex-col gap-3.5">
              <Button
                color="accent"
                fullWidth
                h={48}
                loading={loginMutation.isPending}
                radius={10}
                rightSection={<ArrowRightIcon aria-hidden="true" size={15} />}
                styles={{ label: { fontSize: 15, fontWeight: 600 } }}
                type="submit"
              >
                {t('auth.login')}
              </Button>

              <Divider
                label={t('auth.orContinueWith')}
                labelPosition="center"
                styles={{
                  label: {
                    fontSize: 12,
                    color: 'var(--mantine-color-placeholder)',
                  },
                }}
              />

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  h={44}
                  leftSection={<GlobalIcon aria-hidden="true" size={15} />}
                  radius={10}
                  styles={{ label: { fontSize: 13.5, fontWeight: 600 } }}
                  type="button"
                  variant="default"
                >
                  Google
                </Button>
                <Button
                  h={44}
                  leftSection={<PasswordIcon aria-hidden="true" size={15} />}
                  radius={10}
                  styles={{ label: { fontSize: 13.5, fontWeight: 600 } }}
                  type="button"
                  variant="default"
                >
                  {t('auth.loginWithCode')}
                </Button>
              </div>
            </div>
          </form>

          <p className="flex items-center justify-center gap-1.5 text-[13.5px] text-[var(--mantine-color-dimmed)]">
            {t('auth.residentNoAccount')}
            <Anchor component="button" fw={600} fz={13.5} type="button">
              {t('auth.useYourInvitation')}
            </Anchor>
          </p>
        </div>

        <div className="absolute bottom-8 flex justify-center gap-[18px] text-xs text-[var(--mantine-color-placeholder)]">
          <span>{t('auth.footerPrivacy')}</span>
          <span>{t('auth.footerTerms')}</span>
          <span>{t('auth.footerSupport')}</span>
        </div>
      </section>
    </main>
  )
}
