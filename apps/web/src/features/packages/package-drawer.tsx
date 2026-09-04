import { Badge, Button, Text, TextInput } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DrawerFact, DrawerFacts, DrawerSection } from '../../components/ui/detail-drawer-parts'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { shortDate, shortDateTime } from '../finances/month'
import { deliverPackage, type PackageSummary } from './api'

/** Mockup 14 drawer: the facts and the one action, Marcar entregado. */
export function PackageDrawer({
  onClose,
  pkg,
  timezone,
}: {
  onClose: () => void
  pkg: PackageSummary | null
  timezone: string
}) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const [deliveredTo, setDeliveredTo] = useState('')

  const close = () => {
    setDeliveredTo('')
    onClose()
  }

  const deliver = useMutation({
    mutationFn: () => deliverPackage(pkg!.id, deliveredTo.trim() || null),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['packages'] }),
        queryClient.invalidateQueries({ queryKey: ['registry', 'units'] }),
      ])
      close()
      notifySuccess(t('packages.delivered'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
  })

  const pending = pkg?.status === 'pending'

  return (
    <AppDrawer
      opened={pkg !== null}
      subtitle={
        pkg
          ? pending
            ? t('packages.detail.pendingSince', { date: shortDate(pkg.received_at.slice(0, 10)) })
            : t('packages.detail.deliveredOn', { date: pkg.delivered_at ? shortDate(pkg.delivered_at.slice(0, 10)) : '—' })
          : undefined
      }
      title={pkg ? t('packages.detail.title', { unit: pkg.unit_number ?? '' }) : ''}
      onClose={close}
    >
      <AppDrawerBody>
        {pkg ? (
          <>
            <Badge className="self-start" color={pending ? 'warning' : 'success'} radius="xl" size="md" variant="light">
              {t(`packages.statuses.${pkg.status}`)}
            </Badge>
            <DrawerFacts>
              <DrawerFact
                label={t('packages.columns.unit')}
                value={
                  <Link className="text-[var(--wa-interactive)] no-underline hover:underline" params={{ unitId: pkg.unit_id }} to="/admin/registry/units/$unitId">
                    {[pkg.unit_number, pkg.building_name].filter(Boolean).join(' · ')} →
                  </Link>
                }
              />
              <DrawerFact label={t('packages.columns.for')} value={pkg.resident_name ?? t('packages.primaryContact')} />
              <DrawerFact
                label={t('packages.columns.received')}
                value={[shortDateTime(pkg.received_at, timezone), pkg.received_by_name].filter(Boolean).join(' · ')}
              />
              <DrawerFact
                label={t('packages.detail.notice')}
                value={pkg.notified_email ? t('packages.detail.noticeSent', { email: pkg.notified_email }) : t('packages.detail.noticeSkipped')}
              />
              {pkg.delivered_at ? (
                <DrawerFact
                  wide
                  label={t('packages.statuses.delivered')}
                  value={[
                    shortDateTime(pkg.delivered_at, timezone),
                    pkg.delivered_to ? t('packages.detail.deliveredTo', { name: pkg.delivered_to }) : null,
                    pkg.delivered_by_name ? t('packages.detail.deliveredBy', { name: pkg.delivered_by_name }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ) : null}
              {pkg.notes ? <DrawerFact wide label={t('registry.notes')} value={pkg.notes} /> : null}
            </DrawerFacts>

            <DrawerSection label={t('finances.detail.actions')} />
            {pending ? (
              <>
                <TextInput
                  label={t('packages.detail.deliveredToLabel')}
                  placeholder={t('packages.detail.deliveredToPlaceholder')}
                  value={deliveredTo}
                  onChange={(event) => setDeliveredTo(event.currentTarget.value)}
                />
                <Button color="accent" fullWidth loading={deliver.isPending} onClick={() => deliver.mutate()}>
                  {t('packages.markDelivered')}
                </Button>
              </>
            ) : (
              <Text c="dimmed" size="sm">
                {t('packages.detail.noActions')}
              </Text>
            )}
          </>
        ) : null}
      </AppDrawerBody>
      <AppDrawerFooter>
        <Button className="mr-auto" variant="subtle" onClick={close}>
          {t('finances.detail.close')}
        </Button>
      </AppDrawerFooter>
    </AppDrawer>
  )
}
