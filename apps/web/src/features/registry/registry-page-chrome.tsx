import { Button, Group, Select, TextInput } from '@mantine/core'
import { AddCircle } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { statusOptions } from './status-options'

export function RegistryHeader({
  actionLabel,
  extra,
  onAction,
  title,
}: {
  actionLabel: string
  extra?: ReactNode
  onAction: () => void
  title: string
}) {
  return (
    <Group justify="space-between">
      <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">{title}</h1>
      <Group gap="sm">
        {extra}
        <Button leftSection={<AddCircle size={16} />} onClick={onAction}>
          {actionLabel}
        </Button>
      </Group>
    </Group>
  )
}

export function RegistryFilters({
  extraFilters,
  onSearch,
  onStatus,
  search,
  status,
}: {
  extraFilters?: ReactNode
  onSearch: (value: string) => void
  onStatus: (value: string | null) => void
  search: string
  status: string
}) {
  const { t } = useTranslation('common')

  return (
    <div
      className={
        extraFilters
          ? 'grid gap-3 md:grid-cols-[1fr_180px_180px]'
          : 'grid gap-3 md:grid-cols-[1fr_180px]'
      }
    >
      <TextInput
        defaultValue={search}
        label={t('actions.search')}
        onBlur={(event) => onSearch(event.currentTarget.value)}
      />
      <Select
        clearable
        data={statusOptions(t)}
        label={t('registry.status')}
        value={status || null}
        onChange={onStatus}
      />
      {extraFilters}
    </div>
  )
}
