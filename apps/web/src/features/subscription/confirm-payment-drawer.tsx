import { ActionIcon, Button, NumberInput, Text, TextInput } from '@mantine/core'
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@mantine/dropzone'
import { CheckCircleIcon, CloseCircleIcon, CloudUploadIcon, DocumentIcon } from '@solar-icons/react/linear'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppDrawer, AppDrawerBody, AppDrawerFooter } from '../../components/ui/app-drawer'
import { DateField } from '../../components/ui/date-field'
import { getErrorMessage } from '../../lib/errors'
import { useMe } from '../auth/hooks'
import { subscriptionPageQueryKey, uploadPaymentProof, type Invoice } from './api'
import { formatPeriod, formatPlanMoney } from './format'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * "Confirmar pago" (mockup 22c): the drawer a pending or rejected invoice
 * opens. Only the file is required; the payment details help the review.
 * Success replaces the body without closing, so the admin reads what
 * happens next before leaving.
 */
export function ConfirmPaymentDrawer({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const me = useMe().data
  const [file, setFile] = useState<File | null>(null)
  const [paidOn, setPaidOn] = useState('')
  const [amount, setAmount] = useState<number | string>('')
  const [operation, setOperation] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: ({ invoiceId, file: proof }: { invoiceId: string; file: File }) =>
      uploadPaymentProof(invoiceId, proof, {
        paid_on: paidOn || undefined,
        amount_minor: typeof amount === 'number' && amount > 0 ? Math.round(amount * 100) : undefined,
        operation_number: operation.trim() || undefined,
      }),
    onSuccess: async () => {
      setSent(true)
      await queryClient.invalidateQueries({ queryKey: subscriptionPageQueryKey })
    },
    onError: (err) => setError(getErrorMessage(err)),
    meta: { suppressErrorNotification: true },
  })

  function reset() {
    setFile(null); setPaidOn(''); setAmount(''); setOperation(''); setError(''); setSent(false)
  }
  function close() {
    reset()
    onClose()
  }
  function submit() {
    if (!invoice) return
    if (!file) { setError(t('subscription.proof.fileRequired')); return }
    setError('')
    mutation.mutate({ invoiceId: invoice.id, file })
  }

  const opened = invoice !== null
  const subtitle = invoice ? t('subscription.proof.subtitle', { number: invoice.number, amount: formatPlanMoney(invoice.amount_minor, invoice.currency), period: formatPeriod(invoice.period_starts_on, invoice.period_ends_on) }) : undefined

  return (
    <AppDrawer onClose={close} opened={opened} subtitle={subtitle} title={t('subscription.proof.title')} width={480}>
      {sent ? (
        <AppDrawerBody>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircleIcon aria-hidden="true" className="text-[var(--wa-success)]" size={40} />
            <p className="m-0 font-display text-xl font-bold text-[var(--mantine-color-text)]">{t('subscription.proof.sentTitle')}</p>
            <Text c="dimmed" size="sm">{t('subscription.proof.sentBody', { email: me?.user.email })}</Text>
            <Button className="mt-2" onClick={close} variant="default">{t('subscription.proof.done')}</Button>
          </div>
        </AppDrawerBody>
      ) : (
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => { event.preventDefault(); submit() }}>
          <AppDrawerBody>
            {file ? (
              <div className="flex items-center gap-3 rounded-inner border border-[var(--mantine-color-default-border)] bg-[var(--wa-surface-2)] px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--wa-tint)] text-[10px] font-bold text-[var(--mantine-color-teal-4)]">
                  {file.type === 'application/pdf' ? 'PDF' : <DocumentIcon aria-hidden="true" size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-[var(--mantine-color-text)]">{file.name}</p>
                  <p className="m-0 text-xs text-[var(--mantine-color-dimmed)]">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                </div>
                <ActionIcon aria-label={t('subscription.proof.remove')} onClick={() => setFile(null)} variant="subtle"><CloseCircleIcon aria-hidden="true" size={18} /></ActionIcon>
              </div>
            ) : (
              <Dropzone
                accept={[...IMAGE_MIME_TYPE.filter((type) => type === 'image/jpeg' || type === 'image/png'), ...PDF_MIME_TYPE]}
                aria-label={t('subscription.proof.drop')}
                // relative keeps the hidden file input anchored inside the drawer.
                className="relative grid min-h-[170px] place-items-center rounded-inner border border-dashed border-[var(--mantine-color-default-border)] bg-transparent"
                maxSize={MAX_BYTES}
                multiple={false}
                onDrop={(files) => { setError(''); setFile(files[0] ?? null) }}
                onReject={() => setError(t('subscription.proof.rejected'))}
              >
                <div className="pointer-events-none flex flex-col items-center gap-1.5 px-4 text-center">
                  <CloudUploadIcon aria-hidden="true" className="text-[var(--mantine-color-dimmed)]" size={26} />
                  <Text fw={600} size="sm">{t('subscription.proof.drop')}</Text>
                  <Text c="dimmed" size="xs">{t('subscription.proof.dropHint')}</Text>
                </div>
              </Dropzone>
            )}

            <div>
              <p className="m-0 mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--mantine-color-dimmed)]">{t('subscription.proof.detailsTitle')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField label={t('subscription.proof.paidOn')} maxDate={new Date().toISOString().slice(0, 10)} value={paidOn} onChange={setPaidOn} />
                <NumberInput allowNegative={false} decimalScale={2} label={t('subscription.proof.amount')} min={0} onChange={setAmount} prefix="S/ " thousandSeparator="," value={amount} />
              </div>
              <TextInput className="mt-4" label={t('subscription.proof.operation')} maxLength={60} onChange={(event) => setOperation(event.currentTarget.value)} placeholder={t('subscription.proof.operationPlaceholder')} value={operation} />
            </div>
            {error ? <p className="m-0 text-sm text-[var(--wa-error)]" role="alert">{error}</p> : null}
          </AppDrawerBody>
          <AppDrawerFooter>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row-reverse">
                <Button className="w-full shrink-0 sm:w-auto" color="accent" loading={mutation.isPending} type="submit">{t('subscription.proof.submit')}</Button>
                <Button className="w-full shrink-0 sm:w-auto" disabled={mutation.isPending} onClick={close} variant="default">{t('actions.cancel')}</Button>
              </div>
              <p className="m-0 text-center text-xs text-[var(--mantine-color-dimmed)] sm:text-right">{t('subscription.proof.reviewNote')}</p>
            </div>
          </AppDrawerFooter>
        </form>
      )}
    </AppDrawer>
  )
}
