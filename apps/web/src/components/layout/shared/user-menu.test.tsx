import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import '../../../i18n'
import { mantineTheme } from '../../../app/theme'
import { UserMenu } from './user-menu'

const mocks = vi.hoisted(() => ({
  mobile: false,
  logout: vi.fn(),
  navigate: vi.fn(),
  me: {
    user: { id: 'usr_1', first_name: 'Ana', last_name: 'Torres', name: 'Ana Torres', email: 'ana.torres@wasiy.pe' },
    accounts: [], active_account: null, active_location: null,
    roles: { account: [{ account_id: 'acc_1', role: 'account_admin' }], location: [] },
    accessible_locations: [], resident_memberships: [],
  },
}))

vi.mock('@mantine/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mantine/hooks')>()),
  useMediaQuery: () => mocks.mobile,
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: mocks.navigate }),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; [key: string]: unknown }) => <a href={to} {...props}>{children}</a>,
}))
vi.mock('../../../features/auth/hooks', () => ({
  useMe: () => ({ data: mocks.me }),
  useLocationContext: () => ({ currentLocation: null, accessibleLocations: [], hasMultipleLocations: false }),
  useLogout: () => ({ isPending: false, mutate: mocks.logout }),
}))

function renderMenu() {
  return render(
    <MantineProvider defaultColorScheme="auto" env="test" theme={mantineTheme}>
      <UserMenu />
    </MantineProvider>,
  )
}

afterEach(() => { cleanup(); mocks.mobile = false; vi.clearAllMocks() })

describe('UserMenu', () => {
  it('anchors a menu with identity, role and logout on desktop', async () => {
    renderMenu()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abrir menú de usuario' }))

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Ana Torres')).toBeInTheDocument()
    expect(within(menu).getByText('ana.torres@wasiy.pe')).toBeInTheDocument()
    expect(within(menu).getByText('Superadmin')).toBeInTheDocument()
    // Two blocks only: the identity link into Mi cuenta and the way out.
    expect(within(menu).getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/admin/account')
    expect(within(menu).queryByRole('radiogroup')).not.toBeInTheDocument()

    await user.click(within(menu).getByRole('button', { name: 'Cerrar sesión' }))
    expect(mocks.logout).toHaveBeenCalledOnce()
  })

  it('opens a bottom sheet with the same two blocks on phones', async () => {
    mocks.mobile = true
    renderMenu()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Abrir menú de usuario' }))

    const sheet = await screen.findByRole('dialog')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Ana Torres')).toBeInTheDocument()
    expect(within(sheet).getByText('Superadmin')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('href', '/admin/account')
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })
})
