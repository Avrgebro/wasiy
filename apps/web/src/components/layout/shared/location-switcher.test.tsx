import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../../i18n'
import { mantineTheme } from '../../../app/theme'
import {
  LocationSwitcher,
  MobileLocationSheet,
} from './location-switcher'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  me: {
    user: {
      id: 'usr_1',
      first_name: 'Mariana',
      last_name: 'Rojas',
      name: 'Mariana Rojas',
      email: 'manager@wasiy.test',
    },
    accounts: [
      {
        id: 'acc_1',
        name: 'Administradora Horizonte',
        slug: 'administradora-horizonte',
        timezone: 'America/Lima',
        locations_count: 7,
      },
    ],
    active_account: {
      id: 'acc_1',
      name: 'Administradora Horizonte',
      slug: 'administradora-horizonte',
      timezone: 'America/Lima',
      locations_count: 7,
    },
    active_location: {
      id: 'loc_1',
      account_id: 'acc_1',
      name: 'Edificio Central',
      slug: 'edificio-central',
      timezone: 'America/Lima',
      address: 'Lima',
      roles: ['location_manager'],
      access_source: 'location_role',
    },
    roles: {
      account: [],
      location: [
        {
          account_id: 'acc_1',
          location_id: 'loc_1',
          role: 'location_manager',
        },
      ],
    },
    accessible_locations: [
      {
        id: 'loc_1',
        account_id: 'acc_1',
        name: 'Edificio Central',
        slug: 'edificio-central',
        timezone: 'America/Lima',
        address: 'Lima',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
      {
        id: 'loc_2',
        account_id: 'acc_1',
        name: 'Torre Sur',
        slug: 'torre-sur',
        timezone: 'America/Lima',
        address: 'Lima',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
      {
        id: 'loc_3',
        account_id: 'acc_1',
        name: 'Parque Residencial',
        slug: 'parque-residencial',
        timezone: 'America/Lima',
        address: 'Miraflores',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
      {
        id: 'loc_4',
        account_id: 'acc_1',
        name: 'Condominio del Valle',
        slug: 'condominio-del-valle',
        timezone: 'America/Lima',
        address: 'Surco',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
      {
        id: 'loc_5',
        account_id: 'acc_1',
        name: 'Torre Norte',
        slug: 'torre-norte',
        timezone: 'America/Lima',
        address: 'San Isidro',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
      {
        id: 'loc_6',
        account_id: 'acc_1',
        name: 'Residencial Los Cedros',
        slug: 'residencial-los-cedros',
        timezone: 'America/Lima',
        address: 'San Borja',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
      {
        id: 'loc_7',
        account_id: 'acc_1',
        name: 'Edificio Pacífico',
        slug: 'edificio-pacifico',
        timezone: 'America/Lima',
        address: 'Barranco',
        roles: ['location_manager'],
        access_source: 'location_role',
      },
    ],
    resident_memberships: [],
  },
}))

vi.mock('../../../features/auth/hooks', () => ({
  useMe: () => ({ data: mocks.me }),
  useSelectLocation: () => ({
    isPending: false,
    mutate: mocks.mutate,
    variables: undefined,
  }),
}))

describe('LocationSwitcher', () => {
  it('opens its Mantine popover from the current-location control', async () => {
    const user = userEvent.setup()

    render(
      <MantineProvider env="test" theme={mantineTheme}>
        <LocationSwitcher />
      </MantineProvider>,
    )

    await user.click(
      screen.getByRole('button', { name: 'Seleccionar ubicación' }),
    )

    expect(
      await screen.findByRole('dialog', { name: 'Seleccionar ubicación' }),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'Seleccionar ubicación' }),
    )

    expect(
      screen.queryByRole('dialog', { name: 'Seleccionar ubicación' }),
    ).not.toBeInTheDocument()
  })

  it('renders the mobile picker as a searchable bottom drawer', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <MantineProvider env="test" theme={mantineTheme}>
        <MobileLocationSheet onClose={onClose} opened />
      </MantineProvider>,
    )

    expect(await screen.findByText('Ubicaciones')).toBeVisible()
    const drawer = screen.getByRole('dialog')

    const search = within(drawer).getByRole('textbox', {
      name: 'Buscar ubicación',
    })

    await user.type(search, 'Torre Sur')

    expect(within(drawer).getByText('Torre Sur')).toBeVisible()
    expect(within(drawer).queryByText('Edificio Central')).not.toBeInTheDocument()
    expect(
      within(drawer).getByText('1 ubicación coincide con la búsqueda'),
    ).toBeVisible()
  })
})
