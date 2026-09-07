import { ArrowRightIcon } from '@solar-icons/react/linear'
import { Alert, Anchor, Button, Checkbox, PinInput, TextInput } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { authFieldStyles } from './auth-field-styles'
import { getPendingLoginCode, type PendingLoginCode } from './api'
import { useRequestLoginCode, useVerifyLoginCode } from './hooks'
import type { MeResponse } from './types'
import { ApiError } from '../../app/api-client'
import { getErrorMessage } from '../../lib/errors'

const emailSchema = z.string().trim().min(1, 'validation.emailRequired').email('validation.emailInvalid')

type Props = {
  remember: boolean
  onRememberChange: (remember: boolean) => void
  onBack: () => void
  onSuccess: (me: MeResponse) => Promise<void> | void
}

/**
 * Passwordless login in two steps: ask for the email, then for the 6-digit
 * code the API emailed. Same rhythm as the registration OTP (10-minute code,
 * 30-second resend cooldown) so both flows feel identical.
 */
export function LoginCodeForm(props: Props) {
  // A code requested in an earlier tab is still valid in this session; land
  // on the code step for it rather than asking for another one. Nothing
  // renders until we know, so the email step never flashes first.
  const pending = useQuery({
    queryKey: ['login-code', 'pending'],
    queryFn: getPendingLoginCode,
    staleTime: 0,
    gcTime: 0,
  })
  if (pending.isPending) return null

  return <LoginCodeSteps {...props} initial={pending.data?.data ?? null} />
}

function LoginCodeSteps({ remember, onRememberChange, onBack, onSuccess, initial }: Props & { initial: PendingLoginCode | null }) {
  const { t } = useTranslation('common')
  const request = useRequestLoginCode()
  const verify = useVerifyLoginCode()
  const [email, setEmail] = useState(initial?.email ?? '')
  const [emailError, setEmailError] = useState('')
  const [sentTo, setSentTo] = useState(initial?.email ?? '')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [rootError, setRootError] = useState('')
  const [cooldown, setCooldown] = useState(initial?.resend_after ?? 0)
  const busy = request.isPending || verify.isPending

  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function fieldError(error: unknown, field: string) {
    return error instanceof ApiError ? error.errors?.[field]?.[0] : undefined
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setEmailError(t(parsed.error.issues[0].message))
      return
    }
    setEmailError('')
    setRootError('')
    try {
      const { data } = await request.mutateAsync(parsed.data)
      setSentTo(data.email)
      setCooldown(data.resend_after)
      setCode('')
      setCodeError('')
    } catch (error) {
      const perField = fieldError(error, 'email')
      if (perField) setEmailError(perField)
      else setRootError(getErrorMessage(error))
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    setRootError('')
    try {
      const { session } = await verify.mutateAsync({ code, remember })
      await onSuccess(session)
    } catch (error) {
      const perField = fieldError(error, 'code')
      if (perField) setCodeError(perField)
      else setRootError(getErrorMessage(error))
    }
  }

  const rememberBox = (
    <Checkbox
      checked={remember}
      color="accent"
      label={t('auth.rememberMe')}
      onChange={event => onRememberChange(event.currentTarget.checked)}
      radius={5}
      size="sm"
      styles={{ label: { fontSize: 13.5 } }}
    />
  )

  if (!sentTo) {
    return (
      <form className="flex flex-col gap-[26px]" onSubmit={sendCode}>
        <div className="flex flex-col gap-4">
          {rootError ? <Alert color="error" title={t('auth.codeRequestFailed')}>{rootError}</Alert> : null}
          <TextInput
            autoComplete="email"
            autoFocus
            disabled={busy}
            error={emailError}
            label={t('auth.email')}
            onChange={event => { setEmail(event.currentTarget.value); setEmailError('') }}
            styles={authFieldStyles}
            type="email"
            value={email}
          />
          {rememberBox}
        </div>
        <div className="flex flex-col gap-3.5">
          <Button color="accent" fullWidth h={48} loading={busy} radius={10} rightSection={<ArrowRightIcon aria-hidden="true" size={15} />} styles={{ label: { fontSize: 15, fontWeight: 600 } }} type="submit">
            {t('auth.sendCode')}
          </Button>
          <Anchor component="button" fw={600} fz={13.5} onClick={onBack} type="button">
            {t('auth.usePassword')}
          </Anchor>
        </div>
      </form>
    )
  }

  return (
    <form className="flex flex-col gap-[26px]" onSubmit={submitCode}>
      <div className="flex flex-col gap-4">
        {rootError ? <Alert color="error" title={t('auth.codeVerifyFailed')}>{rootError}</Alert> : null}
        <p className="text-[15px] text-[var(--mantine-color-dimmed)]">{t('auth.codeSentTo', { email: sentTo })}</p>
        <PinInput
          ariaLabel={t('auth.codeDigits')}
          autoFocus
          disabled={busy}
          error={!!codeError}
          gap={6}
          getInputProps={index => ({ 'aria-label': t('auth.codeDigit', { index: index + 1 }), 'aria-describedby': codeError ? 'login-code-error' : undefined })}
          length={6}
          onChange={value => { setCode(value); setCodeError('') }}
          oneTimeCode
          placeholder=""
          radius={10}
          size="md"
          styles={{ input: { textAlign: 'center', padding: 0 } }}
          type="number"
          value={code}
        />
        {codeError ? <p className="text-sm text-[var(--mantine-color-error-7)]" id="login-code-error" role="alert">{codeError}</p> : null}
        {rememberBox}
      </div>
      <div className="flex flex-col gap-3.5">
        <Button color="accent" disabled={code.length !== 6} fullWidth h={48} loading={verify.isPending} radius={10} rightSection={<ArrowRightIcon aria-hidden="true" size={15} />} styles={{ label: { fontSize: 15, fontWeight: 600 } }} type="submit">
          {t('auth.verifyCode')}
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button disabled={busy || cooldown > 0} h={44} onClick={() => void sendCode()} radius={10} styles={{ label: { fontSize: 13.5, fontWeight: 600 } }} type="button" variant="default">
            {cooldown ? t('auth.resendCodeIn', { seconds: cooldown }) : t('auth.resendCode')}
          </Button>
          <Button disabled={busy} h={44} onClick={() => { setSentTo(''); setCode(''); setCodeError('') }} radius={10} styles={{ label: { fontSize: 13.5, fontWeight: 600 } }} type="button" variant="default">
            {t('auth.changeEmail')}
          </Button>
        </div>
        <Anchor component="button" fw={600} fz={13.5} onClick={onBack} type="button">
          {t('auth.usePassword')}
        </Anchor>
      </div>
    </form>
  )
}
