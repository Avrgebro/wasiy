import { Alert, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useMe } from '../auth/hooks'
import { getAccountSettings, updateAccountSettings } from './api'
import { OperationalSettingsPanel } from './operational-settings'

/**
 * /admin/settings: the Account level of the settings cascade — the defaults
 * every Location inherits. Same component as the location tab; the account
 * level has no parent, so its explanation degenerates to override-or-default.
 */
export function AccountSettingsPage() {
  const { t } = useTranslation('common')
  const me = useMe().data
  const account = me?.active_account

  if (!me || !account) {
    return (
      <Alert color="warning" title={t('auth.noAccessTitle')}>
        {t('accountSelection.title')}
      </Alert>
    )
  }

  return (
    <div className="@container flex flex-col gap-6">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">
          {t('settings.accountTitle')}
        </h1>
        <Text c="dimmed" mt={6} size="sm">
          {t('settings.accountSubtitle', { account: account.name })}
        </Text>
      </div>
      <OperationalSettingsPanel
        fetchSettings={() => getAccountSettings(account.id)}
        level="account"
        saveSettings={(payload) => updateAccountSettings(account.id, payload)}
        scopeName={account.name ?? ''}
        settingsQueryKey={['account-settings', account.id]}
      />
    </div>
  )
}
