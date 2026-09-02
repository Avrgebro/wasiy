import { Alert, Button, NumberInput, Skeleton, Switch, Text, TextInput } from '@mantine/core'
import { notifySuccess, notifyError } from '../../lib/notify'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'
import type {
  OperationalSettingsValues,
  SettingsExplanation,
  SettingsPayload,
  SettingsResponse,
} from './api'

type SettingKey = keyof OperationalSettingsValues

/**
 * One group's pending edits: a key absent is untouched, present with a
 * value overrides at this level, present as null clears the override —
 * exactly the API's merge-write contract, held in component state.
 */
type Draft = SettingsPayload

type Level = 'account' | 'location'

type Translate = (key: string, options?: Record<string, unknown>) => string

const AUTO_CHECKOUT_CHOICES = [4, 8, 12, 24, 0] as const

/**
 * The Configuración tab (mockup 06) and the account-level settings page:
 * four groups, each with its own Descartar / Guardar, every control showing
 * its effective value including inherited defaults — never empty inputs.
 */
export function OperationalSettingsPanel({
  fetchSettings,
  level,
  readOnly = false,
  saveSettings,
  scopeName,
  settingsQueryKey,
  timezone,
}: {
  fetchSettings: () => Promise<SettingsResponse>
  level: Level
  readOnly?: boolean
  saveSettings: (payload: SettingsPayload) => Promise<SettingsResponse>
  scopeName: string
  settingsQueryKey: readonly unknown[]
  timezone?: string
}) {
  const { t } = useTranslation('common')
  const query = useQuery({ queryKey: settingsQueryKey, queryFn: fetchSettings })

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        <Skeleton height={230} radius="lg" />
        <Skeleton height={230} radius="lg" />
        <Skeleton height={210} radius="lg" />
        <Skeleton height={210} radius="lg" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <Alert color="error" title={t('errors.loadFailed')}>
        {getErrorMessage(query.error)}
      </Alert>
    )
  }

  const shared = {
    explanation: query.data.data.explanation,
    level,
    readOnly,
    saveSettings,
    scopeName,
    settingsQueryKey,
    t,
    values: query.data.data.values,
  }

  return (
    <div className="flex flex-col gap-4">
      <Text c="dimmed" size="sm">
        {level === 'location' ? t('settings.intro') : t('settings.introAccount')}
      </Text>
      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        <VisitorsGroup {...shared} />
        <ReservationsGroup {...shared} />
        <QuietHoursGroup {...shared} timezone={timezone} />
        <AnnouncementsGroup {...shared} />
      </div>
    </div>
  )
}

type GroupProps = {
  explanation: SettingsExplanation
  level: Level
  readOnly: boolean
  saveSettings: (payload: SettingsPayload) => Promise<SettingsResponse>
  scopeName: string
  settingsQueryKey: readonly unknown[]
  t: Translate
  values: OperationalSettingsValues
}

function useGroup(props: GroupProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>({})

  const mutation = useMutation({
    mutationFn: (payload: Draft) => props.saveSettings(payload),
    onSuccess: async () => {
      setDraft({})
      await queryClient.invalidateQueries({ queryKey: props.settingsQueryKey })
      notifySuccess(props.t('settings.saved'))
    },
    onError: (error) => {
      notifyError(getErrorMessage(error))
    },
  })

  function effective<K extends SettingKey>(key: K): OperationalSettingsValues[K] {
    if (key in draft) {
      const pending = draft[key]

      if (pending === null || pending === undefined) {
        // Cleared: preview what inheriting gives.
        const parent = props.explanation[key].account_value

        return (parent ?? props.values[key]) as OperationalSettingsValues[K]
      }

      return pending as OperationalSettingsValues[K]
    }

    return props.values[key]
  }

  return {
    dirty: Object.keys(draft).length > 0,
    discard: () => setDraft({}),
    draft,
    effective,
    save: () => mutation.mutate(draft),
    saving: mutation.isPending,
    set: <K extends SettingKey>(key: K, value: OperationalSettingsValues[K] | null) =>
      setDraft((current) => ({ ...current, [key]: value })),
  }
}

function SettingsGroup({
  children,
  footerHint,
  group,
  readOnly,
  t,
  title,
}: {
  children: ReactNode
  footerHint: string
  group: ReturnType<typeof useGroup>
  readOnly: boolean
  t: Translate
  title: string
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)]">
      <div className="border-b border-[var(--mantine-color-default-border)] px-5 py-4">
        <Text fw={600}>{title}</Text>
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-[var(--mantine-color-default-border)] px-5 py-2.5">
        <Text c="dimmed" size="xs">
          {footerHint}
        </Text>
        {readOnly ? null : (
          <div className="flex items-center gap-2">
            <Button disabled={!group.dirty} size="xs" variant="subtle" onClick={group.discard}>
              {t('settings.discard')}
            </Button>
            <Button
              color="accent"
              disabled={!group.dirty}
              loading={group.saving}
              size="xs"
              onClick={group.save}
            >
              {t('actions.save')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function SettingRow({
  control,
  description,
  label,
}: {
  control: ReactNode
  description: string
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Text fw={600} size="sm">
          {label}
        </Text>
        <Text c="dimmed" mt={2} size="xs">
          {description}
        </Text>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/**
 * "En vigencia: … · valor de la cuenta: …" with the teal dot from the
 * mockup, plus the clear-override affordance when this level overrides.
 */
function EffectLine({
  cleared,
  onClear,
  overridden,
  t,
  text,
}: {
  cleared: boolean
  onClear?: () => void
  overridden: boolean
  t: Translate
  text: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--mantine-color-dimmed)]">
      <span className="size-[5px] shrink-0 rounded-full bg-[var(--wa-secondary)]" />
      <span>{text}</span>
      {overridden && !cleared && onClear ? (
        <button
          className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-medium text-[var(--wa-interactive)]"
          type="button"
          onClick={onClear}
        >
          {t('settings.clearOverride')}
        </button>
      ) : null}
      {cleared ? <span className="italic">{t('settings.willInherit')}</span> : null}
    </div>
  )
}

function autoCheckoutLabel(t: Translate, hours: number) {
  return hours === 0 ? t('settings.visitors.never') : t('settings.hoursValue', { hours })
}

function VisitorsGroup(props: GroupProps) {
  const { explanation, level, readOnly, t } = props
  const group = useGroup(props)
  const checkoutInfo = explanation.visitor_auto_checkout_hours

  const effectText =
    level === 'location'
      ? t('settings.effectWithAccount', {
          effective: autoCheckoutLabel(t, group.effective('visitor_auto_checkout_hours')),
          account: autoCheckoutLabel(t, checkoutInfo.account_value ?? 0),
        })
      : t('settings.effectOnly', {
          effective: autoCheckoutLabel(t, group.effective('visitor_auto_checkout_hours')),
        })

  return (
    <SettingsGroup
      footerHint={
        level === 'location'
          ? t('settings.appliesOnlyTo', { name: props.scopeName })
          : t('settings.appliesToAccount', { name: props.scopeName })
      }
      group={group}
      readOnly={readOnly}
      t={t}
      title={t('settings.visitors.title')}
    >
      <SettingRow
        control={
          <Switch
            checked={group.effective('visitor_preregistration_enabled')}
            disabled={readOnly}
            onChange={(event) =>
              group.set('visitor_preregistration_enabled', event.currentTarget.checked)
            }
          />
        }
        description={t('settings.visitors.preregistrationHint')}
        label={t('settings.visitors.preregistration')}
      />
      <div className="h-px bg-[var(--mantine-color-default-border)]" />
      <div className="flex flex-col gap-2.5">
        <div>
          <Text fw={600} size="sm">
            {t('settings.visitors.autoCheckout')}
          </Text>
          <Text c="dimmed" mt={2} size="xs">
            {t('settings.visitors.autoCheckoutHint')}
          </Text>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AUTO_CHECKOUT_CHOICES.map((hours) => {
            const selected = group.effective('visitor_auto_checkout_hours') === hours

            return (
              <button
                key={hours}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? 'border-[var(--wa-accent)] bg-[var(--wa-accent)] text-[#1c2b2c]'
                    : 'border-[var(--mantine-color-default-border)] bg-transparent text-[var(--mantine-color-dimmed)]'
                }`}
                disabled={readOnly}
                type="button"
                onClick={() => group.set('visitor_auto_checkout_hours', hours)}
              >
                {hours === 0 ? t('settings.visitors.never') : `${hours} h`}
              </button>
            )
          })}
        </div>
        <EffectLine
          cleared={group.draft.visitor_auto_checkout_hours === null}
          overridden={checkoutInfo.source === level}
          t={t}
          text={effectText}
          onClear={
            level === 'location'
              ? () => group.set('visitor_auto_checkout_hours', null)
              : undefined
          }
        />
      </div>
    </SettingsGroup>
  )
}

function ReservationsGroup(props: GroupProps) {
  const { explanation, level, readOnly, t } = props
  const group = useGroup(props)

  const fields = [
    { key: 'reservation_max_advance_days', label: t('settings.reservations.maxAdvance'), unit: t('settings.reservations.days') },
    { key: 'reservation_max_concurrent_per_unit', label: t('settings.reservations.maxConcurrent'), unit: t('settings.reservations.reservations') },
    { key: 'reservation_cancellation_window_hours', label: t('settings.reservations.cancellationWindow'), unit: t('settings.reservations.hours') },
  ] as const

  return (
    <SettingsGroup
      footerHint={t('settings.reservations.footer')}
      group={group}
      readOnly={readOnly}
      t={t}
      title={t('settings.reservations.title')}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {fields.map((field) => {
          const info = explanation[field.key]

          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">
                {field.label}
              </span>
              <NumberInput
                allowNegative={false}
                aria-label={field.label}
                className="w-32"
                disabled={readOnly}
                min={1}
                suffix={` ${field.unit}`}
                value={group.effective(field.key)}
                onChange={(value) => {
                  if (typeof value === 'number') {
                    group.set(field.key, value)
                  }
                }}
              />
              <EffectLine
                cleared={group.draft[field.key] === null}
                overridden={info.source === level}
                t={t}
                text={
                  level === 'location'
                    ? info.source === 'location'
                      ? t('settings.overridesAccount', { account: info.account_value })
                      : t('settings.inheritedFromAccount', { account: info.account_value })
                    : t('settings.effectOnly', { effective: group.effective(field.key) })
                }
                onClear={level === 'location' ? () => group.set(field.key, null) : undefined}
              />
            </div>
          )
        })}
      </div>
      <Text c="dimmed" size="xs">
        {t('settings.reservations.amenityOverrideHint')}
      </Text>
    </SettingsGroup>
  )
}

function QuietHoursGroup(props: GroupProps & { timezone?: string }) {
  const { level, readOnly, t, timezone } = props
  const group = useGroup(props)
  const enabled = group.effective('quiet_hours_enabled')
  const start = group.effective('quiet_hours_start') ?? '22:00'
  const end = group.effective('quiet_hours_end') ?? '07:00'

  function setEnabled(next: boolean) {
    group.set('quiet_hours_enabled', next)

    if (next) {
      // Enabling stores explicit times so the effective window never
      // depends on hidden defaults.
      group.set('quiet_hours_start', start)
      group.set('quiet_hours_end', end)
    }
  }

  return (
    <SettingsGroup
      footerHint={t('settings.quietHours.footer')}
      group={group}
      readOnly={readOnly}
      t={t}
      title={t('settings.quietHours.title')}
    >
      <SettingRow
        control={<Switch checked={enabled} disabled={readOnly} onChange={(event) => setEnabled(event.currentTarget.checked)} />}
        description={t('settings.quietHours.enabledHint')}
        label={t('settings.quietHours.enabled')}
      />
      {enabled ? (
        <>
          <div className="flex gap-6">
            <TextInput
              aria-label={t('settings.quietHours.start')}
              className="w-32"
              disabled={readOnly}
              label={t('settings.quietHours.start')}
              type="time"
              value={start}
              onChange={(event) => group.set('quiet_hours_start', event.currentTarget.value)}
            />
            <TextInput
              aria-label={t('settings.quietHours.end')}
              className="w-32"
              disabled={readOnly}
              label={t('settings.quietHours.end')}
              type="time"
              value={end}
              onChange={(event) => group.set('quiet_hours_end', event.currentTarget.value)}
            />
          </div>
          <EffectLine
            cleared={false}
            overridden={props.explanation.quiet_hours_enabled.source === level}
            t={t}
            text={t('settings.quietHours.effect', {
              start,
              end,
              timezone: timezone ?? '',
            })}
          />
        </>
      ) : null}
    </SettingsGroup>
  )
}

function AnnouncementsGroup(props: GroupProps) {
  const { readOnly, t } = props
  const group = useGroup(props)

  return (
    <SettingsGroup
      footerHint={
        props.level === 'location'
          ? t('settings.appliesOnlyTo', { name: props.scopeName })
          : t('settings.appliesToAccount', { name: props.scopeName })
      }
      group={group}
      readOnly={readOnly}
      t={t}
      title={t('settings.announcements.title')}
    >
      <SettingRow
        control={
          <Switch
            checked={group.effective('announcements_location_manager_can_post')}
            disabled={readOnly}
            onChange={(event) =>
              group.set('announcements_location_manager_can_post', event.currentTarget.checked)
            }
          />
        }
        description={t('settings.announcements.managerCanPostHint')}
        label={t('settings.announcements.managerCanPost')}
      />
      <div className="h-px bg-[var(--mantine-color-default-border)]" />
      <SettingRow
        control={
          <Switch
            checked={group.effective('announcements_email_residents')}
            disabled={readOnly}
            onChange={(event) =>
              group.set('announcements_email_residents', event.currentTarget.checked)
            }
          />
        }
        description={t('settings.announcements.emailResidentsHint')}
        label={t('settings.announcements.emailResidents')}
      />
    </SettingsGroup>
  )
}
