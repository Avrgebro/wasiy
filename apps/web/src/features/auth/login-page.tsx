import { Button, PasswordInput, TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation('common')

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-4">
      <form className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--card)] p-5">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {t('auth.loginTitle')}
        </h1>
        <div className="mt-5 grid gap-4">
          <TextInput label={t('auth.email')} placeholder="admin@wasiy.local" />
          <PasswordInput label={t('auth.password')} />
          <Button type="submit">{t('auth.login')}</Button>
        </div>
      </form>
    </main>
  )
}
