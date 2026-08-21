import { CheckIcon, Drawer, Loader, Popover, TextInput } from '@mantine/core'
import {
  AltArrowDown,
  Buildings2,
  MinimalisticMagnifier,
} from '@solar-icons/react'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ComponentPropsWithoutRef, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { isAccountAdmin } from '../../../features/auth/access'
import {
  useLocationContext,
  useMe,
  useSelectLocation,
} from '../../../features/auth/hooks'
import type { LocationSummary } from '../../../features/auth/types'

const LOCATION_SEARCH_THRESHOLD = 5

function getLocationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function getLocationDetail(location: LocationSummary) {
  return location.address ?? location.timezone
}

function LocationAvatar({
  active = false,
  location,
  size = 'sm',
}: {
  active?: boolean
  location: LocationSummary
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span
      className={`${
        size === 'lg'
          ? 'size-10 rounded-[11px] text-sm'
          : size === 'md'
            ? 'size-[34px] rounded-[9px] text-xs'
            : 'size-[30px] rounded-lg text-xs'
      } flex shrink-0 items-center justify-center border font-display font-semibold ${
        active
          ? 'border-transparent bg-[var(--mantine-color-teal-4)] text-white'
          : 'border-[var(--mantine-color-default-border)] bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))] text-[light-dark(var(--mantine-color-teal-7),var(--mantine-color-dark-2))]'
      }`}
    >
      {getLocationInitials(location.name)}
    </span>
  )
}

function CurrentLocation({
  interactive,
  location,
  opened = false,
  pending = false,
  ref,
  ...buttonProps
}: {
  interactive: boolean
  location: LocationSummary
  opened?: boolean
  pending?: boolean
  ref?: Ref<HTMLButtonElement>
} & Omit<ComponentPropsWithoutRef<'button'>, 'children'>) {
  const { t } = useTranslation('common')
  const content = (
    <>
      <LocationAvatar active location={location} size="md" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13.5px] font-semibold text-[var(--mantine-color-text)]">
          {location.name}
        </span>
        <span className="mt-px block truncate text-[11.5px] font-normal text-[var(--mantine-color-dimmed)]">
          {opened
            ? t('shell.selectingLocation')
            : interactive
              ? (
                  <>
                    <span className="group-hover:hidden">
                      {getLocationDetail(location)}
                    </span>
                    <span className="hidden group-hover:inline">
                      {t('shell.changeLocation')}
                    </span>
                  </>
                )
              : getLocationDetail(location)}
        </span>
      </span>
      {interactive ? (
        pending ? (
          <Loader aria-label={t('common.loading')} size={14} />
        ) : (
          <AltArrowDown
            aria-hidden="true"
            className="shrink-0 text-[var(--mantine-color-dimmed)] transition-transform duration-150 data-[opened=true]:rotate-180"
            data-opened={opened}
            size={14}
          />
        )
      ) : null}
    </>
  )

  if (!interactive) {
    return (
      <div className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--mantine-color-default-border)] bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))] px-2.5 py-[9px]">
        {content}
      </div>
    )
  }

  return (
    <button
      {...buttonProps}
      aria-expanded={opened}
      aria-haspopup="dialog"
      aria-label={t('shell.selectLocation')}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--mantine-color-default-border)] bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))] px-2.5 py-[9px] text-left transition-colors hover:border-[var(--mantine-color-teal-4)] hover:bg-[light-dark(var(--mantine-color-teal-1),var(--mantine-color-dark-5))] disabled:cursor-wait disabled:opacity-70 data-[opened=true]:border-[var(--mantine-color-teal-4)]"
      data-opened={opened}
      disabled={pending}
      ref={ref}
      type="button"
    >
      {content}
    </button>
  )
}

function LocationOption({
  active,
  disabled,
  location,
  mobile = false,
  onSelect,
  pending,
}: {
  active: boolean
  disabled: boolean
  location: LocationSummary
  mobile?: boolean
  onSelect: () => void
  pending: boolean
}) {
  const { t } = useTranslation('common')

  return (
    <button
      aria-current={active ? 'true' : undefined}
      // The sheet's focus trap lands on the active row (never the search
      // input, which would open the mobile keyboard over the sheet).
      data-autofocus={mobile && active ? true : undefined}
      className={`flex w-full cursor-pointer items-center rounded-xl text-left transition-colors hover:bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))] disabled:cursor-wait disabled:opacity-70 ${
        mobile ? 'gap-3 px-3 py-[11px]' : 'gap-2.5 px-2.5 py-2'
      } ${
        active
          ? 'bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-teal-6))]'
          : ''
      }`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <LocationAvatar
        active={active}
        location={location}
        size={mobile ? 'lg' : 'sm'}
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-semibold text-[var(--mantine-color-text)] ${
            mobile ? 'text-[15px]' : 'text-[13.5px]'
          }`}
        >
          {location.name}
        </span>
        <span
          className={`mt-px block truncate font-normal text-[var(--mantine-color-dimmed)] ${
            mobile ? 'text-xs' : 'text-[11.5px]'
          }`}
        >
          {getLocationDetail(location)}
        </span>
      </span>
      {pending ? (
        <Loader aria-label={t('common.loading')} size={15} />
      ) : active ? (
        <CheckIcon
          aria-label={t('shell.currentLocation')}
          className="shrink-0 text-[var(--mantine-color-amber-4)]"
          size={15}
        />
      ) : null}
    </button>
  )
}

function useLocationPicker(onClose: () => void) {
  const { t } = useTranslation('common')
  const me = useMe().data
  const { accessibleLocations, currentLocation, hasMultipleLocations } =
    useLocationContext()
  const selectLocationMutation = useSelectLocation()
  const [search, setSearch] = useState('')

  const filteredLocations = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()

    if (!normalizedSearch) {
      return accessibleLocations
    }

    return accessibleLocations.filter((availableLocation) =>
      [
        availableLocation.name,
        availableLocation.address,
        availableLocation.timezone,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)),
    )
  }, [accessibleLocations, search])

  function close() {
    setSearch('')
    onClose()
  }

  function select(locationId: string) {
    if (locationId === currentLocation?.id) {
      close()
      return
    }

    selectLocationMutation.mutate(locationId, { onSuccess: close })
  }

  const accountName = currentLocation
    ? (me?.active_account?.name ??
      me?.accounts.find(
        (account) => account.id === currentLocation.account_id,
      )?.name ??
      t('shell.account'))
    : t('shell.account')

  return {
    accountName,
    canManageLocations: me ? isAccountAdmin(me) : false,
    close,
    currentLocation,
    filteredLocations,
    hasMultipleAccounts: (me?.accounts.length ?? 0) > 1,
    hasMultipleLocations,
    pendingLocationId: selectLocationMutation.isPending
      ? selectLocationMutation.variables
      : undefined,
    search,
    select,
    selectionPending: selectLocationMutation.isPending,
    setSearch,
    showSearch: accessibleLocations.length >= LOCATION_SEARCH_THRESHOLD,
  }
}

type LocationPicker = ReturnType<typeof useLocationPicker>

function LocationSearch({
  mobile = false,
  picker,
}: {
  mobile?: boolean
  picker: LocationPicker
}) {
  const { t } = useTranslation('common')

  if (!picker.showSearch) {
    return null
  }

  // Never autofocused: search is secondary to tapping a row, and focusing on
  // mount opens the mobile keyboard over the sheet. The scroll margin keeps
  // the input clear of the sheet edge when the browser scrolls it into view.
  return (
    <TextInput
      aria-label={t('shell.locationSearchPlaceholder')}
      classNames={{ input: 'scroll-m-6' }}
      enterKeyHint="search"
      leftSection={<MinimalisticMagnifier aria-hidden="true" size={15} />}
      onChange={(event) => picker.setSearch(event.currentTarget.value)}
      placeholder={t('shell.locationSearchPlaceholder')}
      radius={9}
      size={mobile ? 'sm' : 'xs'}
      value={picker.search}
    />
  )
}

function LocationOptions({
  mobile = false,
  picker,
}: {
  mobile?: boolean
  picker: LocationPicker
}) {
  const { t } = useTranslation('common')

  return (
    <div
      className={`flex flex-col gap-0.5 overflow-y-auto ${
        mobile ? 'max-h-[min(48dvh,360px)] px-2' : 'max-h-[272px] p-2'
      }`}
    >
      {picker.filteredLocations.length > 0 ? (
        picker.filteredLocations.map((availableLocation) => (
          <LocationOption
            active={availableLocation.id === picker.currentLocation?.id}
            disabled={picker.selectionPending}
            key={availableLocation.id}
            location={availableLocation}
            mobile={mobile}
            onSelect={() => picker.select(availableLocation.id)}
            pending={picker.pendingLocationId === availableLocation.id}
          />
        ))
      ) : (
        <p className="px-3 py-6 text-center text-xs text-[var(--mantine-color-dimmed)]">
          {t('shell.noLocationMatches')}
        </p>
      )}
    </div>
  )
}

function LocationPickerFooter({ picker }: { picker: LocationPicker }) {
  const { t } = useTranslation('common')

  if (picker.search.trim()) {
    return (
      <p className="border-t border-[var(--mantine-color-default-border)] px-3.5 py-2.5 text-[11.5px] text-[var(--mantine-color-placeholder)]">
        {t('shell.locationMatchCount', {
          count: picker.filteredLocations.length,
        })}
      </p>
    )
  }

  if (!picker.canManageLocations) {
    return null
  }

  return (
    <div className="border-t border-[var(--mantine-color-default-border)] p-2">
      <Link
        className="flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-semibold text-[var(--mantine-color-text)] no-underline transition-colors hover:bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))]"
        onClick={picker.close}
        to="/admin/locations"
      >
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))] text-[light-dark(var(--mantine-color-teal-6),var(--mantine-color-teal-3))]">
          <Buildings2 aria-hidden="true" size={15} />
        </span>
        {t('shell.viewAllLocations')}
      </Link>
    </div>
  )
}

export function LocationSwitcher() {
  const { t } = useTranslation('common')
  const [opened, setOpened] = useState(false)
  const picker = useLocationPicker(() => setOpened(false))

  if (!picker.currentLocation) {
    return null
  }

  if (!picker.hasMultipleLocations) {
    return (
      <CurrentLocation interactive={false} location={picker.currentLocation} />
    )
  }

  return (
    <Popover
      offset={10}
      onChange={(nextOpened) => {
        // picker.close resets the search besides closing, so every close
        // path (outside click, escape, trigger toggle, selection) shares it.
        if (nextOpened) {
          setOpened(true)
        } else {
          picker.close()
        }
      }}
      opened={opened}
      position="bottom-start"
      shadow="xl"
      trapFocus
      width={340}
      withinPortal
    >
      <Popover.Target>
        <CurrentLocation
          interactive
          location={picker.currentLocation}
          onClick={() => (opened ? picker.close() : setOpened(true))}
          opened={opened}
          pending={picker.selectionPending}
        />
      </Popover.Target>

      <Popover.Dropdown
        aria-label={t('shell.selectLocation')}
        className="max-w-[calc(100vw-2rem)] overflow-hidden rounded-[14px] border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-0"
        role="dialog"
      >
        <div className="flex flex-col gap-2.5 border-b border-[var(--mantine-color-default-border)] px-3.5 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--mantine-color-placeholder)]">
              {picker.accountName}
            </p>
            {picker.hasMultipleAccounts ? (
              <Link
                className="shrink-0 text-[11.5px] font-semibold text-[light-dark(var(--mantine-color-teal-6),var(--mantine-color-teal-3))] no-underline hover:text-[var(--mantine-color-teal-4)]"
                onClick={picker.close}
                to="/select-account"
              >
                {t('shell.changeAccount')}
              </Link>
            ) : null}
          </div>
          <LocationSearch picker={picker} />
        </div>

        <LocationOptions picker={picker} />
        <LocationPickerFooter picker={picker} />
      </Popover.Dropdown>
    </Popover>
  )
}

export function MobileLocationButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('common')
  const { currentLocation, hasMultipleLocations } = useLocationContext()

  if (!currentLocation) {
    return null
  }

  const interactive = hasMultipleLocations

  return (
    <button
      aria-label={interactive ? t('shell.selectLocation') : undefined}
      className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[light-dark(var(--mantine-color-teal-0),var(--mantine-color-dark-5))] px-3.5 py-3 text-left disabled:cursor-default"
      disabled={!interactive}
      onClick={onClick}
      type="button"
    >
      <LocationAvatar active location={currentLocation} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--mantine-color-text)]">
          {currentLocation.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[var(--mantine-color-dimmed)]">
          {getLocationDetail(currentLocation)}
        </span>
      </span>
      {interactive ? (
        <span className="shrink-0 text-[12.5px] font-semibold text-[light-dark(var(--mantine-color-teal-6),var(--mantine-color-teal-3))]">
          {t('shell.changeLocationShort')}
        </span>
      ) : null}
    </button>
  )
}

export function MobileLocationSheet({
  onClose,
  opened,
}: {
  onClose: () => void
  opened: boolean
}) {
  const { t } = useTranslation('common')
  const picker = useLocationPicker(onClose)

  const title = (
    <div className="flex w-full flex-col gap-3">
      <span
        aria-hidden="true"
        className="h-1 w-10 self-center rounded-full bg-[var(--mantine-color-default-border)]"
      />
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-[17px] font-semibold text-[var(--mantine-color-text)]">
          {t('shell.locations')}
        </span>
        {picker.hasMultipleAccounts ? (
          <Link
            className="text-[12.5px] font-semibold text-[light-dark(var(--mantine-color-teal-6),var(--mantine-color-teal-3))] no-underline"
            onClick={picker.close}
            to="/select-account"
          >
            {t('shell.changeAccount')}
          </Link>
        ) : null}
      </div>
    </div>
  )

  return (
    <Drawer
      classNames={{ content: '!border-0 !p-0' }}
      styles={{
        body: {
          padding: '0 0 max(1rem, env(safe-area-inset-bottom))',
        },
        content: {
          background: 'var(--mantine-color-default)',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid var(--mantine-color-default-border)',
          height: 'auto',
          maxHeight: 'min(82dvh, 560px)',
          overflow: 'hidden',
        },
        header: {
          background: 'transparent',
          padding: '0.5rem 1rem',
        },
        title: { width: '100%' },
      }}
      onClose={picker.close}
      opened={opened && picker.hasMultipleLocations}
      overlayProps={{
        backgroundOpacity: 0.72,
        color: 'var(--mantine-color-dark-9)',
      }}
      padding={0}
      position="bottom"
      radius="20px 20px 0 0"
      size="min(82dvh, 560px)"
      title={title}
      withCloseButton={false}
    >
      <div className="flex flex-col gap-3">
        <div className="px-4">
          <LocationSearch mobile picker={picker} />
        </div>
        <LocationOptions mobile picker={picker} />
        <div className="px-2">
          <LocationPickerFooter picker={picker} />
        </div>
      </div>
    </Drawer>
  )
}
