import {
  Avatar,
  Center,
  Menu,
  SegmentedControl,
  Text,
  UnstyledButton,
  VisuallyHidden,
  useMantineColorScheme,
} from '@mantine/core'
import { Logout, Monitor, MoonStars, Sun2 } from '@solar-icons/react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useLogout, useMe } from '../../../features/auth/hooks'

const themeIconProps = { size: 16, style: { display: 'block' } } as const

export function UserMenu() {
  const { t } = useTranslation('common')
  const router = useRouter()
  const meQuery = useMe()
  const logoutMutation = useLogout()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const user = meQuery.data?.user

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => void router.navigate({ to: '/login' }),
    })
  }

  return (
    <Menu position="bottom-end" width={240}>
      <Menu.Target>
        <UnstyledButton
          aria-label={t('shell.userMenu')}
          className="rounded-full"
        >
          <Avatar color="initials" name={user?.name} radius="xl" size="md" />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <div className="px-3 py-2">
          <Text fw={600} size="sm" truncate>
            {user?.name}
          </Text>
          <Text c="dimmed" size="xs" truncate>
            {user?.email}
          </Text>
        </div>
        <Menu.Divider />
        <Menu.Label>{t('theme.label')}</Menu.Label>
        <div className="px-3 pb-2">
          <SegmentedControl
            fullWidth
            onChange={(value) =>
              setColorScheme(value as 'light' | 'dark' | 'auto')
            }
            size="xs"
            value={colorScheme}
            data={[
              {
                value: 'light',
                label: (
                  <Center>
                    <Sun2 {...themeIconProps} />
                    <VisuallyHidden>{t('theme.light')}</VisuallyHidden>
                  </Center>
                ),
              },
              {
                value: 'dark',
                label: (
                  <Center>
                    <MoonStars {...themeIconProps} />
                    <VisuallyHidden>{t('theme.dark')}</VisuallyHidden>
                  </Center>
                ),
              },
              {
                value: 'auto',
                label: (
                  <Center>
                    <Monitor {...themeIconProps} />
                    <VisuallyHidden>{t('theme.auto')}</VisuallyHidden>
                  </Center>
                ),
              },
            ]}
          />
        </div>
        <Menu.Divider />
        <Menu.Item
          color="error"
          disabled={logoutMutation.isPending}
          leftSection={<Logout size={16} />}
          onClick={handleLogout}
        >
          {t('auth.logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
