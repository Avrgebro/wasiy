import { Alert, Loader } from '@mantine/core'
import { AltArrowRight } from '@solar-icons/react'
import { useRouter } from '@tanstack/react-router'
import '@fontsource/sora/600.css'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import { useTranslation } from 'react-i18next'
import { getDefaultAuthenticatedRoute } from './access'
import { useLogout, useMe, useSelectAccount } from './hooks'
import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'
import { getErrorMessage } from '../../lib/errors'

function accountInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

/**
 * Faint Wasiy-mark watermark anchored to the corner, per mockup 13. Uses the
 * real logo geometry; the stroke is a near-background tone in both schemes.
 */
function Watermark() {
  return (
    <svg
      aria-hidden="true"
      className="absolute -bottom-28 -right-28 size-[min(70vh,50vw)] max-w-none text-[var(--wa-watermark)]"
      fill="none"
      viewBox="0 0 48 48"
    >
      <path
        d="M8 12 v16 a8 8 0 0 0 16 0 v-16
          M24 12 v16 a8 8 0 0 0 16 0 v-16
          M40 28 v6 a2 2 0 0 1 -2 2 h-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="6.5"
      />
      <circle cx="32" cy="19" r="3.5" fill="#E0A438" opacity="0.16" />
    </svg>
  )
}

export function SelectAccountPage() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const meQuery = useMe()
  const logoutMutation = useLogout()
  const selectAccountMutation = useSelectAccount()

  function handleSelectAccount(accountId: string) {
    selectAccountMutation.mutate(accountId, {
      onSuccess: (me) =>
        void router.navigate({ to: getDefaultAuthenticatedRoute(me) }),
    })
  }

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  const error = selectAccountMutation.error

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--mantine-color-body)] px-4 py-8 font-brand [--mantine-font-family:var(--font-brand)]">
      <Watermark />

      <section className="relative flex w-full max-w-[440px] flex-col gap-7">
        <div className="flex items-center justify-center gap-2.5">
          <WasiyLogo
            className="shrink-0 text-[var(--wa-brand-mark)]"
            size={30}
          />
          <span className="font-display text-[22px] font-semibold tracking-tight text-[var(--mantine-color-text)]">
            Wasiy
          </span>
        </div>

        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-[var(--mantine-color-text)]">
            {t('accountSelection.title')}
          </h1>
          <p className="text-[14.5px] leading-relaxed text-[var(--mantine-color-dimmed)]">
            {t('accountSelection.summary')}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {meQuery.isLoading ? (
            <div className="grid min-h-24 place-items-center">
              <Loader aria-label={t('common.loading')} />
            </div>
          ) : null}

          {error ? (
            <Alert color="red" title={t('accountSelection.selectFailed')}>
              {getErrorMessage(error)}
            </Alert>
          ) : null}

          {meQuery.data?.accounts.map((account) => {
            const pending =
              selectAccountMutation.isPending &&
              selectAccountMutation.variables === account.id

            return (
              <button
                className="group flex cursor-pointer items-center gap-3.5 rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] px-[18px] py-4 text-left transition-colors hover:border-[var(--mantine-color-teal-4)] hover:bg-[var(--wa-tint)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={selectAccountMutation.isPending}
                key={account.id}
                onClick={() => handleSelectAccount(account.id)}
                type="button"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[11px] border border-[var(--mantine-color-default-border)] bg-[var(--wa-tint)] font-display text-[17px] font-semibold text-[var(--wa-teal-text)] transition-colors group-hover:border-transparent group-hover:bg-[var(--mantine-color-amber-4)] group-hover:text-[#1C2B2C]">
                  {accountInitials(account.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--mantine-color-text)]">
                    {account.name}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-[var(--mantine-color-dimmed)]">
                    {t('accountSelection.locationCount', {
                      count: account.locations_count,
                    })}
                  </span>
                </span>
                {pending ? (
                  <Loader size={16} />
                ) : (
                  <AltArrowRight
                    aria-hidden="true"
                    className="shrink-0 text-[var(--mantine-color-placeholder)] transition-colors group-hover:text-[var(--wa-teal-text)]"
                    size={16}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex justify-center">
          <button
            className="cursor-pointer text-[13.5px] font-medium text-[var(--mantine-color-placeholder)] transition-colors hover:text-[var(--mantine-color-dimmed)] disabled:cursor-not-allowed"
            disabled={logoutMutation.isPending}
            onClick={handleLogout}
            type="button"
          >
            {t('auth.logout')}
          </button>
        </div>
      </section>
    </main>
  )
}
