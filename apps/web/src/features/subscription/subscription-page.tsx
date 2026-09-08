import { Alert, Badge, Button, CopyButton, Skeleton, Text } from '@mantine/core'
import { ArrowDownIcon, CheckCircleIcon, CopyIcon, InfoCircleIcon, WalletIcon } from '@solar-icons/react/linear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionCard, SectionCardFooter } from '../../components/ui/section-card'
import { formatDate } from '../../lib/dates'
import { getErrorMessage } from '../../lib/errors'
import { notifyError, notifySuccess } from '../../lib/notify'
import { useMe } from '../auth/hooks'
import { getSubscriptionPage, paymentProofUrl, requestPlanChange, subscriptionPageQueryKey, type Invoice, type SubscriptionPageData } from './api'
import { ChangeUnitsDrawer } from './change-units-drawer'
import { ConfirmPaymentDrawer } from './confirm-payment-drawer'
import { formatLongDay, formatPeriod, formatPlanMoney } from './format'

/**
 * /admin/subscription (mockup 22, ADR 0040): what am I paying for, where do
 * I stand, what happens next. The state card is the only block that changes
 * colour; blocks 2 to 6 stay put so the admin can always see what is owed
 * and how to pay it. Payment is manual: bank details to copy, a proof
 * uploaded on the invoice, the team confirms.
 */
export function SubscriptionPage({ onConfirmPayment }: { onConfirmPayment?: (invoice: Invoice) => void }) {
  const { t } = useTranslation('common')
  const me = useMe().data
  const page = useQuery({ queryKey: subscriptionPageQueryKey, queryFn: getSubscriptionPage, select: (r) => r.data })
  const invoicesRef = useRef<HTMLElement>(null)
  const [confirming, setConfirming] = useState<Invoice | null>(null)
  const [changingUnits, setChangingUnits] = useState(false)
  const confirm = onConfirmPayment ?? setConfirming

  if (!me?.active_account) {
    return <Alert color="warning" title={t('auth.noAccessTitle')}>{t('accountSelection.title')}</Alert>
  }

  const data = page.data
  const scrollToInvoices = () => invoicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-bold text-[var(--mantine-color-text)]">{t('subscription.title')}</h1>
        <Text c="dimmed" mt={6} size="sm">{t('subscription.subtitle', { account: me.active_account.name })}</Text>
      </div>

      {page.isPending ? <Skeleton height={120} radius="lg" /> : null}
      {page.isSuccess && !data ? <Text c="dimmed">{t('subscription.none')}</Text> : null}

      {data ? (
        <>
          <StateCard data={data} onSeeInvoice={scrollToInvoices} />
          <div className="grid gap-4 md:grid-cols-2">
            <PlanCard data={data} />
            <BillingCard data={data} onExpand={() => setChangingUnits(true)} />
          </div>
          <HowToPayCard data={data} />
          <InvoicesCard data={data} onConfirmPayment={confirm} ref={invoicesRef} />
          <ChangePlanCard data={data} />
        </>
      ) : null}
      <ConfirmPaymentDrawer invoice={confirming} onClose={() => setConfirming(null)} />
      {data ? <ChangeUnitsDrawer data={data} onClose={() => setChangingUnits(false)} opened={changingUnits} /> : null}
    </div>
  )
}

/** Block 1. Pill, the date in display type, one sentence, and only when lapsed a button down to the invoice. */
function StateCard({ data, onSeeInvoice }: { data: SubscriptionPageData; onSeeInvoice: () => void }) {
  const { t } = useTranslation('common')
  const { subscription } = data
  const pending = data.invoices.find((invoice) => invoice.status === 'pending' || invoice.status === 'rejected')
  const kind = subscription.is_lapsed ? 'lapsed' : subscription.status === 'active' ? 'active' : 'trial'
  const tone = { trial: 'accent', active: 'success', lapsed: 'error' }[kind] as 'accent' | 'success' | 'error'
  const pill = { trial: t('subscription.state.trialPill'), active: t('subscription.state.activePill'), lapsed: t('subscription.state.lapsedPill') }[kind]
  const kicker = {
    trial: t('subscription.state.trialKicker'),
    active: subscription.last_paid_at ? t('subscription.state.activeKicker', { date: formatLongDay(subscription.last_paid_at) }) : t('subscription.state.activePill'),
    lapsed: t('subscription.state.lapsedKicker', { date: formatLongDay(subscription.access_until) }),
  }[kind]
  const headline = {
    trial: t('subscription.state.trialHeadline', { date: formatLongDay(subscription.trial_ends_at) }),
    active: t('subscription.state.activeHeadline', { date: formatLongDay(subscription.access_until) }),
    lapsed: t('subscription.state.lapsedHeadline'),
  }[kind]
  const body = {
    trial: pending
      ? t('subscription.state.trialBodyInvoice', { count: subscription.days_left })
      : t('subscription.state.trialBody', { count: subscription.days_left }),
    active: t('subscription.state.activeBody'),
    lapsed: t('subscription.state.lapsedBody'),
  }[kind]

  return (
    <section className="rounded-surface border border-[var(--mantine-color-default-border)] bg-[var(--mantine-color-default)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={tone} radius="xl" size="md" variant="light">{pill}</Badge>
        <span className="text-xs text-[var(--mantine-color-dimmed)]">{kicker}</span>
      </div>
      <p className="m-0 mt-3 font-display text-xl font-semibold tracking-tight text-[var(--mantine-color-text)]">{headline}</p>
      <p className="m-0 mt-1.5 text-sm leading-relaxed text-[var(--mantine-color-dimmed)]">{body}</p>
      {kind === 'lapsed' && pending ? (
        <Button className="mt-4" color="accent" leftSection={<ArrowDownIcon aria-hidden="true" size={16} />} onClick={onSeeInvoice}>{t('subscription.state.seePendingInvoice')}</Button>
      ) : null}
      {kind === 'trial' && pending ? (
        <button className="mt-3 inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-[var(--wa-teal-text)]" onClick={onSeeInvoice} type="button">
          {t('subscription.state.seeInvoice')} <ArrowDownIcon aria-hidden="true" size={14} />
        </button>
      ) : null}
    </section>
  )
}

/** Block 2. */
function PlanCard({ data }: { data: SubscriptionPageData }) {
  const { t } = useTranslation('common')
  const { plan } = data

  return (
    <SectionCard footer={<SectionCardFooter hint={t('subscription.plan.includes', { count: plan.included_units })} />} title={t('subscription.plan.title')}>
      <div>
        <p className="m-0 font-display text-xl font-bold text-[var(--mantine-color-text)]">{plan.name}</p>
        <p className="m-0 mt-1 flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-bold text-[var(--mantine-color-text)]">{formatPlanMoney(plan.unit_price_minor, plan.currency)}</span>
          <span className="text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.plan.perUnit')}</span>
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-[var(--mantine-color-text)]">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2"><CheckCircleIcon aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--mantine-color-teal-4)]" size={16} />{feature}</li>
        ))}
      </ul>
    </SectionCard>
  )
}

/** Block 3. Breakdown, then contracted versus in use: "en uso" only tells how much headroom is left (ADR 0040). */
function BillingCard({ data, onExpand }: { data: SubscriptionPageData; onExpand: () => void }) {
  const { t } = useTranslation('common')
  const { breakdown, subscription, plan } = data
  const headroom = subscription.billable_units - subscription.units_in_use
  const currency = plan.currency

  return (
    <SectionCard
      footer={<SectionCardFooter actions={<Button onClick={onExpand} size="xs" variant="default">{t('subscription.billing.expand')}</Button>} />}
      title={t('subscription.billing.title')}
    >
      <dl className="m-0 flex flex-col gap-2 text-sm">
        <Row label={t('subscription.billing.baseLine', { plan: plan.name, count: breakdown.base_units })} value={formatPlanMoney(breakdown.base_minor, currency)} />
        {breakdown.extra_units > 0 ? <Row label={t('subscription.billing.extraLine', { count: breakdown.extra_units, price: formatPlanMoney(plan.unit_price_minor, currency) })} value={formatPlanMoney(breakdown.extra_minor, currency)} /> : null}
        <div className="my-1 h-px bg-[var(--mantine-color-default-border)]" />
        <Row label={<strong className="text-[var(--mantine-color-text)]">{t('subscription.billing.total')}</strong>} value={<strong className="font-display text-lg text-[var(--mantine-color-text)]">{formatPlanMoney(breakdown.total_minor, currency)}</strong>} />
      </dl>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('subscription.billing.contracted')} value={subscription.billable_units} />
        <Stat label={t('subscription.billing.inUse')} value={subscription.units_in_use} />
      </div>
      <p className={`m-0 flex items-start gap-2 text-sm ${headroom <= 0 ? 'text-[var(--wa-accent)]' : 'text-[var(--mantine-color-dimmed)]'}`}>
        {headroom <= 0 ? <InfoCircleIcon aria-hidden="true" className="mt-0.5 shrink-0" size={16} /> : null}
        {headroom <= 0 ? t('subscription.billing.atLimit') : t('subscription.billing.headroom', { count: headroom })}
      </p>
      {subscription.pending_billable_units !== null && subscription.pending_units_from ? (
        <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.billing.scheduled', { date: formatLongDay(`${subscription.pending_units_from}T12:00:00`), count: subscription.pending_billable_units })}</p>
      ) : null}
    </SectionCard>
  )
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--mantine-color-dimmed)]">{label}</dt>
      <dd className="m-0 text-right text-[var(--mantine-color-text)]">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-inner bg-[var(--wa-surface-2)] px-3 py-2.5">
      <p className="m-0 font-display text-2xl font-bold text-[var(--mantine-color-text)]">{value}</p>
      <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{label}</p>
    </div>
  )
}

/** Block 4. Instructions from config; the reference is the pending invoice. Replaced whole by the provider button later. */
function HowToPayCard({ data }: { data: SubscriptionPageData }) {
  const { t } = useTranslation('common')
  const instructions = data.payment_instructions
  const pending = data.invoices.find((invoice) => invoice.status === 'pending' || invoice.status === 'rejected')
  if (!instructions) return null

  return (
    <SectionCard
      footer={pending ? (
        <SectionCardFooter
          actions={<Copy value={pending.number} />}
          hint={<>{t('subscription.pay.reference')} <span className="ml-1 font-mono text-sm font-semibold text-[var(--mantine-color-text)]">{pending.number}</span></>}
        />
      ) : undefined}
      headerActions={<span className="text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.pay.hint')}</span>}
      title={t('subscription.pay.title')}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {instructions.transfer ? (
          <div className="rounded-inner border border-[var(--mantine-color-default-border)] p-4 md:col-span-2">
            <p className="m-0 flex items-center gap-2 text-sm font-semibold text-[var(--mantine-color-text)]"><WalletIcon aria-hidden="true" size={16} />{t('subscription.pay.transfer')}</p>
            <dl className="m-0 mt-3 flex flex-col gap-2">
              <Fact label={t('subscription.pay.bank')} value={`${instructions.transfer.bank} · ${instructions.transfer.account_type}`} />
              <Fact copy label={t('subscription.pay.account')} value={instructions.transfer.account_number} />
              {instructions.transfer.cci ? <Fact copy label={t('subscription.pay.cci')} value={instructions.transfer.cci} /> : null}
              <Fact label={t('subscription.pay.holder')} value={[instructions.transfer.holder, instructions.transfer.tax_id ? `RUC ${instructions.transfer.tax_id}` : null].filter(Boolean).join(' · ')} />
            </dl>
          </div>
        ) : null}
        {instructions.yape ? <WalletCard holder={instructions.yape.holder} name="Yape" number={instructions.yape.number} /> : null}
        {instructions.plin ? <WalletCard holder={instructions.plin.holder} name="Plin" number={instructions.plin.number} /> : null}
      </div>
    </SectionCard>
  )
}

function WalletCard({ name, number, holder }: { name: string; number: string; holder: string }) {
  return (
    <div className="rounded-inner border border-[var(--mantine-color-default-border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm font-semibold text-[var(--mantine-color-text)]">{name}</p>
        <Copy value={number} />
      </div>
      <p className="m-0 mt-2 font-mono text-sm text-[var(--mantine-color-text)]">{number}</p>
      <p className="m-0 mt-0.5 text-xs text-[var(--mantine-color-dimmed)]">{holder}</p>
    </div>
  )
}

/** One row: a fixed-width label, the value, and a copy button at the end when the value is meant to be pasted. */
function Fact({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-14 shrink-0 text-xs text-[var(--mantine-color-dimmed)]">{label}</dt>
      <dd className={`m-0 min-w-0 flex-1 truncate text-sm text-[var(--mantine-color-text)] ${copy ? 'font-mono' : ''}`}>{value}</dd>
      {copy ? <Copy value={value} /> : null}
    </div>
  )
}

function Copy({ value }: { value: string }) {
  const { t } = useTranslation('common')
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Button className="shrink-0" color={copied ? 'success' : 'teal'} leftSection={copied ? <CheckCircleIcon aria-hidden="true" size={12} /> : <CopyIcon aria-hidden="true" size={12} />} onClick={copy} size="compact-xs" variant="default">
          {copied ? t('subscription.pay.copied') : t('subscription.pay.copy')}
        </Button>
      )}
    </CopyButton>
  )
}

/** Block 5. A table on desktop, two-line rows on phones; the action lives on the row. */
function InvoicesCard({ data, onConfirmPayment, ref }: { data: SubscriptionPageData; onConfirmPayment?: (invoice: Invoice) => void; ref: React.RefObject<HTMLElement | null> }) {
  const { t } = useTranslation('common')

  return (
    <SectionCard className="scroll-mt-4" ref={ref} title={t('subscription.invoices.title')}>
      {data.invoices.length === 0 ? (
        <div className="rounded-inner border border-dashed border-[var(--mantine-color-default-border)] px-4 py-8 text-center">
          <p className="m-0 text-sm font-semibold text-[var(--mantine-color-text)]">{t('subscription.invoices.emptyTitle')}</p>
          <p className="m-0 mt-1 text-sm text-[var(--mantine-color-dimmed)]">{t('subscription.invoices.emptyBody')}</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-[var(--mantine-color-default-border)] p-0">
          {data.invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} onConfirmPayment={onConfirmPayment} />)}
        </ul>
      )}
    </SectionCard>
  )
}

const INVOICE_TONE: Record<Invoice['status'], 'accent' | 'teal' | 'success' | 'error'> = { pending: 'accent', under_review: 'teal', paid: 'success', rejected: 'error' }

function InvoiceRow({ invoice, onConfirmPayment }: { invoice: Invoice; onConfirmPayment?: (invoice: Invoice) => void }) {
  const { t } = useTranslation('common')
  const note = invoice.status === 'under_review'
    ? t('subscription.invoices.underReviewNote')
    : invoice.status === 'rejected'
      ? invoice.rejection_reason
      : invoice.status === 'paid' && invoice.paid_at
        ? t('subscription.invoices.paidNote', { date: formatDate(invoice.paid_at), method: t(`subscription.invoices.method_${invoice.payment_method ?? 'transfer'}`) })
        : null
  const canConfirm = invoice.status === 'pending' || invoice.status === 'rejected'

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[1fr_auto] sm:items-center sm:gap-x-4" data-invoice={invoice.number}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-[var(--mantine-color-text)]">{invoice.number}</span>
          <Badge color={INVOICE_TONE[invoice.status]} radius="xl" size="sm" variant="light">{t(`subscription.invoices.status_${invoice.status}`)}</Badge>
          <span className="ml-auto text-sm font-semibold text-[var(--mantine-color-text)] sm:ml-2">{formatPlanMoney(invoice.amount_minor, invoice.currency)}</span>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--mantine-color-dimmed)]">{formatPeriod(invoice.period_starts_on, invoice.period_ends_on)}</p>
        {note ? <p className={`m-0 mt-1 text-xs ${invoice.status === 'rejected' ? 'text-[var(--wa-error)]' : 'text-[var(--mantine-color-dimmed)]'}`}>{note}</p> : null}
      </div>
      {canConfirm ? (
        <Button className="w-full sm:w-auto" color="accent" onClick={() => onConfirmPayment?.(invoice)} size="sm">{t('subscription.invoices.confirmPayment')}</Button>
      ) : null}
      {invoice.status === 'under_review' && invoice.latest_proof ? (
        <Button className="w-full sm:w-auto" component="a" href={paymentProofUrl(invoice.id, invoice.latest_proof.id)} rel="noreferrer" size="sm" target="_blank" variant="default">{t('subscription.invoices.viewProof')}</Button>
      ) : null}
    </li>
  )
}

/** Block 6. Totals for this account's contracted units; the change is requested here and applied by the team at the renewal. */
function ChangePlanCard({ data }: { data: SubscriptionPageData }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const requested = data.subscription.requested_plan
  const mutation = useMutation({
    mutationFn: requestPlanChange,
    onSuccess: ({ data: next }, plan) => {
      queryClient.setQueryData(subscriptionPageQueryKey, { data: next })
      notifySuccess(t(plan ? 'subscription.changePlan.requested' : 'subscription.changePlan.withdrawn'))
    },
    onError: (error) => notifyError(getErrorMessage(error)),
    meta: { suppressErrorNotification: true },
  })

  return (
    <SectionCard
      footer={<SectionCardFooter hint={t('subscription.changePlan.portfolio')} />}
      headerActions={<span className="text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.changePlan.hint', { count: data.subscription.billable_units })}</span>}
      title={t('subscription.changePlan.title')}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {data.plans.map((plan) => {
          const isRequested = requested?.code === plan.code
          return (
            <div key={plan.code} className={`flex flex-col gap-2 rounded-inner border p-4 ${plan.is_current ? 'border-[var(--mantine-color-teal-4)] bg-[var(--wa-tint)]' : 'border-[var(--mantine-color-default-border)]'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-base font-semibold text-[var(--mantine-color-text)]">{plan.name}</p>
                {plan.is_current ? <Badge color="teal" radius="xl" size="sm" variant="light">{t('subscription.changePlan.current')}</Badge> : null}
                {isRequested ? <Badge color="accent" radius="xl" size="sm" variant="light">{t('subscription.changePlan.requestedPill')}</Badge> : null}
              </div>
              <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.changePlan.pricing', { price: formatPlanMoney(plan.unit_price_minor, data.plan.currency), count: plan.included_units })}</p>
              <p className="m-0 flex items-baseline gap-1"><span className="font-display text-xl font-bold text-[var(--mantine-color-text)]">{formatPlanMoney(plan.total_minor, data.plan.currency)}</span><span className="text-xs text-[var(--mantine-color-dimmed)]">{t('subscription.changePlan.perMonth')}</span></p>
              <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{plan.features.join(' · ')}</p>
              {plan.is_current ? (
                <span className="mt-auto text-xs font-semibold text-[var(--mantine-color-dimmed)]">{t('subscription.changePlan.inUse')}</span>
              ) : isRequested ? (
                <Button className="mt-auto" disabled={mutation.isPending} onClick={() => mutation.mutate(null)} variant="subtle">{t('subscription.changePlan.withdraw')}</Button>
              ) : (
                <Button className="mt-auto" disabled={mutation.isPending || requested !== null} onClick={() => mutation.mutate(plan.code)} variant="default">{t('subscription.changePlan.request')}</Button>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
