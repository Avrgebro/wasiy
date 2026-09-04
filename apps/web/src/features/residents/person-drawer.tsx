import { Badge, Button, Skeleton, Text, TextInput } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { ConfirmDialog, DrawerFact, DrawerFacts, DrawerSection, DrawerTimeline } from '../../components/ui/detail-drawer-parts'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { shortDateTime } from '../finances/month'
import { portalColor } from '../units/unit-presentation'
import { deactivatePerson, getResident, invitePerson, reactivatePerson, type ResidentSummary } from './api'
import { inviteSchema } from './schemas'

/**
 * Mockup 15 drawer: contact facts, the units the person lives in (managed
 * from the unit page), the portal block where the email is asked only when
 * inviting, the history, and the deactivate guard.
 */
export function PersonDrawer({
  canManage,
  locationId,
  onClose,
  onEdit,
  residentId,
  timezone,
}: {
  canManage: boolean
  locationId: string
  onClose: () => void
  onEdit: (person: ResidentSummary) => void
  residentId: string | null
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)

  const close = () => {
    setInviting(false)
    setEmail('')
    setEmailError(null)
    onClose()
  }

  const detailQuery = useQuery({
    enabled: residentId !== null,
    queryKey: ['registry', 'residents', 'detail', residentId],
    queryFn: () => getResident(residentId!),
  })
  const person = detailQuery.data?.data
  const history = detailQuery.data?.history ?? []

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['registry', 'residents'] })

  const invite = useMutation({
    mutationFn: () => invitePerson(residentId!, person?.email ? undefined : email.trim()),
    onSuccess: async () => {
      await invalidate()
      setInviting(false)
      setEmail('')
      notifySuccess(t('units.member.invited'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })
  const deactivate = useMutation({
    mutationFn: () => deactivatePerson(residentId!),
    onSuccess: async () => {
      await invalidate()
      setConfirmingDeactivate(false)
      notifySuccess(t('residents.deactivated'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })
  const reactivate = useMutation({
    mutationFn: () => reactivatePerson(residentId!),
    onSuccess: async () => {
      await invalidate()
      notifySuccess(t('residents.reactivated'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  function sendInvite() {
    if (!person?.email) {
      const parsed = inviteSchema.safeParse({ email })
      if (!parsed.success) {
        setEmailError(t(parsed.error.issues[0]?.message ?? 'validation.emailInvalid'))

        return
      }
    }
    setEmailError(null)
    invite.mutate()
  }

  const inLocation = (person?.memberships ?? []).filter((membership) => membership.location_id === locationId)
  const active = inLocation.filter((membership) => membership.status === 'active')
  const primary = active.find((membership) => membership.is_primary_contact)
  const subtitle = person
    ? active.length > 0
      ? [
          active.map((membership) => membership.unit ? t('units.detail.title', { type: t('units.typesShort.apartment'), number: membership.unit.unit_number }) : null).filter(Boolean).join(', '),
          primary ? t('residents.primaryContactShort') : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('residents.chips.no_unit')
    : undefined

  return (
    <AppDrawer opened={residentId !== null} subtitle={subtitle} title={person?.name ?? t('registry.residents.name')} onClose={close}>
      <AppDrawerBody>
        {detailQuery.isError ? (
          <Text c="error">{getErrorMessage(detailQuery.error)}</Text>
        ) : !person ? (
          <Skeleton height={240} radius="md" />
        ) : (
          <>
            <DrawerFacts>
              <DrawerFact
                label={t('registry.residents.phone')}
                value={
                  person.phone ? (
                    <a className="text-[var(--wa-interactive)] no-underline hover:underline" href={`tel:${person.phone.replace(/\s+/g, '')}`}>
                      {person.phone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              {person.email !== undefined ? <DrawerFact label={t('units.member.email')} value={person.email ?? '—'} /> : null}
              <DrawerFact
                label={t('registry.status')}
                value={
                  <Badge color={person.status === 'active' ? 'success' : 'gray'} radius="xl" size="sm" variant="light">
                    {t(`registry.statuses.${person.status}`)}
                  </Badge>
                }
              />
              <DrawerFact label={t('residents.detail.since')} value={person.created_at ? t('residents.detail.sinceValue', { date: formatDate(person.created_at) }) : '—'} />
            </DrawerFacts>

            <DrawerSection label={t('units.title')} />
            {inLocation.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('residents.detail.noUnits')}
              </Text>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--mantine-color-default-border)] rounded-inner border border-[var(--mantine-color-default-border)]">
                {inLocation.map((membership) => (
                  <Link
                    key={membership.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 text-sm no-underline text-[var(--mantine-color-text)] hover:bg-[var(--mantine-color-default-hover)] ${membership.status === 'inactive' ? 'opacity-60' : ''}`}
                    params={{ unitId: membership.unit_id }}
                    to="/admin/registry/units/$unitId"
                  >
                    <span className="font-display font-semibold">
                      {[membership.unit?.unit_number, membership.unit?.building_name].filter(Boolean).join(' · ')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[var(--mantine-color-dimmed)]">
                      {[membership.is_primary_contact ? t('units.detail.primaryContact') : null, membership.status === 'inactive' ? t('registry.statuses.inactive') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <span className="text-[15px] text-[var(--mantine-color-dimmed)]">›</span>
                  </Link>
                ))}
              </div>
            )}
            <Text c="dimmed" mt={-12} size="xs">
              {t('residents.detail.membershipsHint')}
            </Text>

            <DrawerSection label={t('units.detail.portal')} />
            <div className="flex flex-col gap-3 rounded-inner border border-[var(--mantine-color-default-border)] px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge color={portalColor(person.portal_state)} radius="xl" size="sm" variant="light">
                  {t(`units.portal.${person.portal_state}`)}
                </Badge>
                {canManage && person.portal_state !== 'active' && !inviting ? (
                  <Button size="compact-sm" variant="subtle" onClick={() => setInviting(true)}>
                    {t(person.portal_state === 'invited' ? 'units.member.resendInvite' : 'residents.detail.invite')}
                  </Button>
                ) : null}
              </div>
              {inviting ? (
                <div className="flex flex-col gap-2.5">
                  {!person.email ? (
                    <TextInput
                      autoFocus
                      description={t('residents.detail.emailHint')}
                      error={emailError}
                      label={t('residents.detail.emailLabel')}
                      placeholder="nombre@correo.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.currentTarget.value)}
                    />
                  ) : (
                    <Text size="sm">{t('residents.detail.willSendTo', { email: person.email })}</Text>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="default" onClick={() => { setInviting(false); setEmailError(null) }}>
                      {t('actions.cancel')}
                    </Button>
                    <Button color="accent" loading={invite.isPending} onClick={sendInvite}>
                      {t('residents.detail.sendInvite')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <DrawerSection label={t('finances.history.title')} />
            {history.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t('residents.detail.noHistory')}
              </Text>
            ) : (
              <DrawerTimeline
                items={history.map((entry) => ({
                  id: entry.id,
                  when: entry.created_at ? shortDateTime(entry.created_at, timezone) : '—',
                  label: entry.summary,
                  actor: entry.actor_name ?? t('finances.history.system'),
                }))}
              />
            )}

            {canManage ? (
              <>
                <DrawerSection label={t('finances.detail.actions')} />
                <Button fullWidth variant="default" onClick={() => onEdit(person)}>
                  {t('residents.detail.edit')}
                </Button>
                <div className="mt-2 flex flex-col gap-3 rounded-inner border border-[var(--wa-error)]/40 p-3.5">
                  <div className="min-w-0">
                    <Text fw={600} size="sm">
                      {t('units.form.sensitiveZone')}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {person.status === 'inactive'
                        ? t('residents.detail.reactivateHint')
                        : person.active_membership_count > 0
                          ? t('residents.detail.deactivateBlocked')
                          : t('residents.detail.deactivateHint')}
                    </Text>
                  </div>
                  {person.status === 'inactive' ? (
                    <Button className="w-full" loading={reactivate.isPending} variant="default" onClick={() => reactivate.mutate()}>
                      {t('residents.detail.reactivate')}
                    </Button>
                  ) : (
                    <Button className="w-full" color="error" disabled={person.active_membership_count > 0} variant="light" onClick={() => setConfirmingDeactivate(true)}>
                      {t('residents.detail.deactivate')}
                    </Button>
                  )}
                </div>
                <ConfirmDialog
                  body={t('residents.detail.confirmDeactivateBody')}
                  opened={confirmingDeactivate}
                  title={t('residents.detail.confirmDeactivate', { name: person.name })}
                  onCancel={() => setConfirmingDeactivate(false)}
                  onConfirm={() => deactivate.mutate()}
                />
              </>
            ) : null}
          </>
        )}
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button className="mr-auto" variant="subtle" onClick={close}>
          {t('finances.detail.close')}
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  )
}
