import { ArrowRightIcon, BuildingsIcon, CheckReadIcon, GlobalIcon, LetterIcon, LockPasswordIcon, MapPointIcon } from '@solar-icons/react/linear'
import { money, monthlyTotal, type PlanPricing } from './format'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { Button, Checkbox, PinInput, Radio, UnstyledButton } from '@mantine/core'
import { authFieldStyles } from '../auth/auth-field-styles'
import { RegistrationPlanCard } from './registration-plan-card'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'
import { ApiError } from '../../app/api-client'
import { FormNumberInput, FormPasswordInput, FormSelect, FormTextInput } from '../../components/ui/form-fields'
import { applyLaravelValidationErrors, fieldErrorMessage } from '../../lib/errors'
import { accountSchema, buildingSchema, type AccountFormValues, type BuildingFormInput, type BuildingFormValues } from './schemas'
import type { MeResponse } from '../auth/types'
import { completeRegistration, getRegistrationPlans, registrationCountries, resendRegistrationCode, startRegistration, verifyRegistrationCode, type PendingRegistration, type RegistrationPlan } from './api'

type Plan = 'esencial' | 'operativo'
const steps = ['Tu cuenta', 'Tu edificio', 'Confirmar']


export function RegistrationPage({ initialPlan = 'operativo', initialPending, catalog, onComplete }: { initialPlan?: Plan; initialPending: PendingRegistration | null; catalog: RegistrationPlan[]; onComplete: (session: MeResponse) => Promise<void> }) {
  const [availablePlans, setAvailablePlans] = useState(catalog)
  const plans = Object.fromEntries(availablePlans.map(item => [item.code, { name: item.name, price: item.unit_price_minor, features: item.features, includedUnits: item.included_units }])) as Partial<Record<Plan, PlanPricing>>
  const [plan, setPlan] = useState<Plan>(catalog.some(p => p.code === initialPlan) ? initialPlan : catalog[0]?.code ?? initialPlan)
  const [step, setStep] = useState(initialPending?.verified ? 1 : 0)
  const [verification, setVerification] = useState(!!initialPending && !initialPending.verified)
  const [verifiedEmail, setVerifiedEmail] = useState(initialPending?.verified ? initialPending.email : '')
  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { first_name: initialPending?.first_name ?? '', last_name: initialPending?.last_name ?? '', email: initialPending?.email ?? '', password: '', password_confirmation: '', terms_accepted: !!initialPending },
  })
  const buildingForm = useForm<BuildingFormInput, unknown, BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: { name: '', address: '', district: '', city: 'Lima', country: 'PE', units: '' },
  })
  const account = useWatch({ control: accountForm.control })
  const building = useWatch({ control: buildingForm.control })
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [cooldown, setCooldown] = useState(initialPending?.resend_after ?? 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const selected = plans[plan]
  const units = Number(building.units) || 0
  const countryLabel = registrationCountries.find(c => c.value === building.country)?.label
  const end = new Date()
  end.setDate(end.getDate() + 14)
  const trialEnd = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(end)

  useEffect(() => {
    heading.current?.focus()
  }, [step, verification])
  useEffect(() => {
    if (!cooldown) return
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function perform<T extends FieldValues>(action: () => Promise<void>, form?: UseFormReturn<T>, onFieldErrors?: () => void) {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try { await action() } catch (error) {
      if (error instanceof ApiError) {
        // Field-level 422s go under their input; everything else to the banner.
        if (form && applyLaravelValidationErrors<T>(error, form.setError, Object.keys(form.getValues()))) { onFieldErrors?.(); return }
        const codeMessages = error.errors?.code
        if (verification && codeMessages?.length) { setCodeError(codeMessages.join(' ')); return }
        setError(error.status === 419 ? 'Tu sesión venció. Inténtalo otra vez.' : error.status === 429 ? 'Has realizado varios intentos. Espera un momento antes de continuar.' : Object.values(error.errors ?? {}).flat().join(' ') || error.message || 'No pudimos conectar. Inténtalo otra vez.')
        if (error.status === 410) { setVerification(false); setVerifiedEmail(''); setStep(0) }
        if (error.errors?.plan || error.errors?.unit_price_minor) {
          try { setAvailablePlans((await getRegistrationPlans()).data) } catch { /* Keep the recoverable error visible. */ }
        }
      } else { setError('No pudimos completar el registro. Inténtalo otra vez.') }
    } finally { submitting.current = false; setBusy(false) }
  }
  const submitAccount = (event: FormEvent) => accountForm.handleSubmit(values => perform(async () => {
    const { data } = await startRegistration(values)
    setVerifiedEmail('')
    accountForm.setValue('email', data.email)
    accountForm.resetField('password'); accountForm.resetField('password_confirmation')
    setCode(''); setCodeError(''); setCooldown(data.resend_after); setVerification(true)
  }, accountForm))(event)
  function verifyCode(event: FormEvent) {
    event.preventDefault()
    void perform(async () => {
      const { data } = await verifyRegistrationCode(code)
      setVerifiedEmail(data.email); setVerification(false); setStep(1)
    })
  }
  function resendCode() {
    void perform(async () => {
      const { data } = await resendRegistrationCode()
      setCode(''); setCodeError(''); setCooldown(data.resend_after)
    })
  }
  const submitBuilding = (event: FormEvent) => buildingForm.handleSubmit(() => setStep(2))(event)
  const finish = () => buildingForm.handleSubmit(values => {
    if (!selected) return
    return perform(async () => {
      const { session } = await completeRegistration({ ...values, plan, unit_price_minor: selected.price })
      accountForm.resetField('password'); accountForm.resetField('password_confirmation')
      await onComplete(session)
    // Building fields are hidden on the summary, so show their server errors where they live.
    }, buildingForm, () => setStep(1))
  })()

  return (
    <div id="registration" className="min-h-screen bg-[var(--mantine-color-body)] font-brand text-[var(--mantine-color-text)] [--mantine-font-family:var(--font-brand)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--mantine-color-default-border)] px-5 py-4 md:px-12">
        <a href={import.meta.env.VITE_MARKETING_URL as string} aria-label="Wasiy, inicio" className="flex items-center gap-2.5 text-[var(--wa-brand-mark)]">
          <WasiyLogo size={28} />
          <span className="font-display text-xl font-semibold tracking-tight">Wasiy</span>
        </a>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-[var(--mantine-color-dimmed)] sm:inline">¿Ya tienes una cuenta?</span>
          <Button component={Link} to="/login" variant="default" h={44} radius={10}>Inicia sesión</Button>
        </div>
      </header>

      {/* Tablets stack the form and plan card in one centered column; two columns need lg. */}
      <main className="mx-auto max-w-[640px] px-5 pb-14 pt-8 md:px-8 md:pt-11 lg:max-w-6xl lg:px-12">
        <nav aria-label="Progreso del registro" className="mb-8 hidden md:block">
          <ol className="flex items-center gap-4">
            {steps.map((label, index) => (
              <li key={label} className="flex flex-1 items-center gap-4 last:flex-none">
                <UnstyledButton
                  disabled={busy || index > step || (index > 0 && !verifiedEmail)}
                  aria-current={index === step ? 'step' : undefined}
                  onClick={() => { setStep(index); setVerification(false) }}
                >
                  <span className={`flex items-center gap-2.5 whitespace-nowrap text-sm font-semibold ${index > step ? 'text-[var(--mantine-color-placeholder)]' : 'text-[var(--mantine-color-text)]'}`}>
                    <span aria-hidden="true" className={`flex size-7 items-center justify-center rounded-full text-xs ${index === step ? 'bg-[var(--mantine-color-teal-6)] text-white' : index < step ? 'bg-[#E6F1EB] text-[#2E7D5B]' : 'border border-[var(--mantine-color-default-border)] bg-white'}`}>
                      {index < step ? <CheckReadIcon size={16} /> : index + 1}
                    </span>
                    {label}
                  </span>
                </UnstyledButton>
                {index < steps.length - 1 && <span aria-hidden="true" className="h-0.5 flex-1 bg-[var(--mantine-color-default-border)]" />}
              </li>
            ))}
          </ol>
        </nav>
        <div className="mb-7 md:hidden">
          <div className="flex justify-between text-[13px] text-[var(--mantine-color-dimmed)]"><strong>Paso {step + 1} de 3</strong><span>{steps[step]}</span></div>
          <div role="progressbar" aria-label="Progreso del registro" aria-valuemin={0} aria-valuemax={3} aria-valuenow={step + 1} className="mt-3 h-1 overflow-hidden rounded bg-[var(--mantine-color-default-border)]">
            <div className="h-full bg-[var(--mantine-color-teal-6)]" style={{ width: `${(step + 1) / 3 * 100}%` }} />
          </div>
        </div>

        {error && <p role="alert" className="mb-5 rounded-xl border border-[var(--mantine-color-error-3)] bg-[var(--mantine-color-error-0)] p-4 text-sm text-[var(--mantine-color-error-8)]">{error}</p>}
        {!selected ? <p role="alert">No hay planes disponibles en este momento. Inténtalo más tarde.</p> : (
          <div className={verification ? 'mx-auto max-w-[620px]' : 'grid items-start gap-8 lg:grid-cols-[minmax(0,560fr)_minmax(0,340fr)] lg:gap-10'}>
            <section className={verification ? 'rounded-[18px] border border-[var(--mantine-color-default-border)] bg-white p-5 md:p-8' : 'min-w-0'}>
              <div className="mb-[26px]">
                {verification && <div className="mb-5 text-[var(--mantine-color-teal-6)]"><LetterIcon aria-hidden="true" size={32} /></div>}
                <h1 ref={heading} tabIndex={-1} className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight outline-none md:text-4xl">
                  {verification ? 'Confirma tu correo' : ['Crea tu cuenta', 'Agrega tu primer edificio', 'Todo listo para empezar'][step]}
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--mantine-color-dimmed)] [overflow-wrap:anywhere] md:text-[16.5px]">
                  {verification ? <>Enviamos un código de 6 dígitos a <strong>{account.email}</strong>. No necesitas salir de esta página.</> : ['Empieza con 14 días gratis. Sin tarjeta.', 'Después podrás agregar sus unidades y residentes.', 'Revisa los datos. La prueba de 14 días empieza al confirmar.'][step]}
                </p>
              </div>

              {step === 0 && !verification && (
                <form noValidate onSubmit={submitAccount}>
                  <fieldset disabled={busy} className="flex min-w-0 flex-col gap-[18px] border-0 p-0">
                    <div className="grid grid-cols-2 gap-4">
                      <FormTextInput control={accountForm.control} name="first_name" label="Nombre" autoComplete="given-name" placeholder="Ana" styles={authFieldStyles} />
                      <FormTextInput control={accountForm.control} name="last_name" label="Apellido" autoComplete="family-name" placeholder="Torres" styles={authFieldStyles} />
                    </div>
                    <FormTextInput control={accountForm.control} name="email" label="Correo electrónico" type="email" autoComplete="email" placeholder="ana@administradora.pe" leftSection={<LetterIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />} styles={authFieldStyles} />
                    <FormPasswordInput control={accountForm.control} name="password" label="Contraseña" autoComplete="new-password" placeholder="Mínimo 8 caracteres" leftSection={<LockPasswordIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />} styles={authFieldStyles} />
                    <FormPasswordInput control={accountForm.control} name="password_confirmation" label="Confirmar contraseña" autoComplete="new-password" placeholder="Vuelve a escribir tu contraseña" leftSection={<LockPasswordIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />} styles={authFieldStyles} />
                    <Controller control={accountForm.control} name="terms_accepted" render={({ field, fieldState }) => (
                      <Checkbox color="accent" radius={5} size="sm" styles={{ label: { fontSize: 13.5, color: 'var(--mantine-color-dimmed)' } }} name={field.name} ref={field.ref} onBlur={field.onBlur} checked={field.value} onChange={e => field.onChange(e.currentTarget.checked)} error={fieldErrorMessage(fieldState.error)} label="Acepto los términos del servicio y la política de privacidad." />
                    )} />
                    <Button color="accent" h={48} radius={10} styles={{ label: { fontSize: 15, fontWeight: 600 } }} type="submit" fullWidth loading={busy} rightSection={<ArrowRightIcon aria-hidden="true" size={15} />}>Crear cuenta</Button>
                  </fieldset>
                </form>
              )}

              {verification && (
                <form className="flex flex-col gap-[18px]" onSubmit={verifyCode}>
                  <div role="group" aria-label="Código de verificación">
                    <PinInput placeholder='' disabled={busy} length={6} type="number" oneTimeCode value={code} onChange={value => { setCode(value); setCodeError('') }} error={!!codeError} gap={6} size="md" radius={10} styles={{ input: { textAlign: 'center', padding: 0 } }} ariaLabel="Dígito del código" getInputProps={index => ({ 'aria-label': `Dígito ${index + 1}`, 'aria-describedby': codeError ? 'reg-code-error' : undefined })} />
                  </div>
                  {codeError && <p id="reg-code-error" role="alert" className="text-sm text-[var(--mantine-color-error-7)]">{codeError}</p>}
                  <Button type="submit" color="accent" h={48} radius={10} fullWidth loading={busy} disabled={code.length !== 6}>Confirmar correo</Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="default" h={44} radius={10} disabled={busy || cooldown > 0} onClick={resendCode}>{cooldown ? `Reenviar código en ${cooldown}s` : 'Reenviar código'}</Button>
                    <Button variant="default" h={44} radius={10} disabled={busy} onClick={() => setVerification(false)}>Cambiar correo</Button>
                  </div>
                  <div className="rounded-xl bg-[var(--mantine-color-body)] p-4 text-[13px] leading-relaxed">
                    <strong>¿No llegó o el código ya venció?</strong>
                    <p className="mt-1 text-[var(--mantine-color-dimmed)]">Revisa correo no deseado. El código dura 10 minutos; después puedes solicitar uno nuevo.</p>
                  </div>
                </form>
              )}

              {step === 1 && (
                <form noValidate className="flex flex-col gap-[18px]" onSubmit={submitBuilding}>
                  <FormTextInput control={buildingForm.control} name="name" label="Nombre del edificio" placeholder="Edificio Central" leftSection={<BuildingsIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />} styles={authFieldStyles} />
                  <FormTextInput control={buildingForm.control} name="address" label="Dirección" autoComplete="street-address" placeholder="Av. Javier Prado Este 123" leftSection={<MapPointIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />} styles={authFieldStyles} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormTextInput control={buildingForm.control} name="district" label="Distrito" autoComplete="address-level3" placeholder="San Isidro" styles={authFieldStyles} />
                    <FormTextInput control={buildingForm.control} name="city" label="Ciudad" autoComplete="address-level2" placeholder="Lima" styles={authFieldStyles} />
                  </div>
                  <FormSelect control={buildingForm.control} name="country" label="País" data={registrationCountries} allowDeselect={false} comboboxProps={{ withinPortal: false }} leftSection={<GlobalIcon aria-hidden="true" color="var(--mantine-color-placeholder)" size={16} />} styles={authFieldStyles} />
                  <FormNumberInput control={buildingForm.control} name="units" label="Número total de unidades" placeholder="40" allowDecimal={false} allowNegative={false} min={1} max={10000} step={1} inputMode="numeric" w={220} maw="100%" styles={authFieldStyles}
                    description={`El plan incluye hasta ${selected.includedUnits} unidades.`} />
                  <div className="flex gap-3">
                    <Button variant="default" h={48} radius={10} onClick={() => setStep(0)}>← Atrás</Button>
                    <Button type="submit" color="accent" h={48} radius={10} className="flex-1" rightSection={<ArrowRightIcon aria-hidden="true" size={15} />}>Continuar</Button>
                  </div>
                </form>
              )}

              {step === 2 && (
                <>
                  <div className="mb-6 divide-y divide-[var(--mantine-color-default-border)] overflow-hidden rounded-2xl border border-[var(--mantine-color-default-border)] bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">Administrador de la cuenta</p><strong className="text-sm">{account.first_name} {account.last_name} · {account.email}</strong></div>
                      <span className="rounded-full bg-[#E6F1EB] px-3 py-1 text-xs font-semibold text-[#2E7D5B]">Verificado</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0 [overflow-wrap:anywhere]"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">Edificio</p><strong className="text-sm">{building.name}</strong><p className="mt-1 text-[13px] text-[var(--mantine-color-dimmed)]">{building.address}, {building.district}, {building.city} · {countryLabel}</p><p className="mt-1 text-[13px] text-[var(--mantine-color-dimmed)]">{units} unidades</p></div>
                      <Button variant="default" radius={10} className="shrink-0" disabled={busy} aria-label="Editar edificio" onClick={() => setStep(1)}>Editar</Button>
                    </div>
                  </div>
                  <fieldset className="min-w-0 border-0 p-0">
                    <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--mantine-color-dimmed)]">Plan</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(Object.keys(plans) as Plan[]).map(key => (
                        <div key={key} className={`rounded-2xl border p-[18px] ${plan === key ? 'border-[var(--mantine-color-teal-6)] bg-[var(--mantine-color-teal-6)] text-white' : 'border-[var(--mantine-color-default-border)] bg-white'}`}>
                          <Radio name="plan" value={key} checked={plan === key} onChange={() => setPlan(key)} disabled={busy} color="accent" styles={{ label: { color: 'inherit', cursor: 'pointer' } }} label={
                            <span className="flex flex-col gap-2">
                              <strong className="text-base">{plans[key]!.name}</strong>
                              <span className="text-[13px] leading-relaxed opacity-80">{money(monthlyTotal(plans[key]!, units).total)} al mes con {units} unidades</span>
                              <span className="text-[13px] leading-relaxed opacity-80">{plans[key]!.features.join(' · ')}</span>
                            </span>
                          } />
                        </div>
                      ))}
                    </div>
                  </fieldset>
                  <p className="mt-3 text-xs leading-relaxed text-[var(--mantine-color-dimmed)]">Portafolio, para administradoras con varios edificios, se coordina con el equipo comercial.</p>
                </>
              )}
            </section>

            {!verification && (
              <aside className="flex min-w-0 flex-col gap-4">
                <RegistrationPlanCard step={step} plan={selected} favorite={plan === 'operativo'} units={units} trialEnd={trialEnd} />
                {step === 2 && <>
                  <Button color="accent" h={48} radius={10} fullWidth loading={busy} onClick={finish}>Comenzar prueba gratis</Button>
                  <Button variant="default" h={44} radius={10} fullWidth disabled={busy} onClick={() => setStep(1)}>← Atrás</Button>
                </>}
              </aside>
            )}
          </div>
        )}
      </main>
      <footer className="px-5 py-6 text-center text-xs text-[var(--mantine-color-placeholder)]">Wasiy · Hecho para la vida en comunidad.</footer>
    </div>
  )
}
