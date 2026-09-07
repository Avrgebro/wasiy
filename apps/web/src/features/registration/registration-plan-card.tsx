import { money, moneyShort, monthlyTotal, type PlanPricing } from './format'

type Props = {
  step: number
  plan: PlanPricing
  favorite: boolean
  units: number
  trialEnd: string
}

export function RegistrationPlanCard({ step, plan, favorite, units, trialEnd }: Props) {
  const pricing = monthlyTotal(plan, units)
  const total = money(pricing.total)
  const baseLine = `Plan ${plan.name} · hasta ${plan.includedUnits} unidades`
  const extraLine = `${pricing.extra} unidades adicionales × ${money(plan.price)}`

  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-[var(--mantine-color-default-border)] bg-white p-6 shadow-[0_12px_40px_rgba(28,43,44,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mantine-color-teal-4)]">{step === 2 ? 'Resumen' : 'Plan elegido'}</p>
          <h2 className="mt-1.5 font-display text-[19px] font-semibold">{step === 2 ? `Plan ${plan.name}` : plan.name}</h2>
        </div>
        {step === 0 && favorite && <span className="shrink-0 rounded-full bg-[var(--mantine-color-accent-6)] px-3 py-1 text-[11.5px] font-semibold uppercase">El favorito</span>}
      </div>

      {step < 2 ? (
        <>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <strong className="font-display text-4xl font-semibold tracking-tight">{moneyShort(pricing.base)}</strong>
            <span className="text-[13.5px] text-[var(--mantine-color-dimmed)]">/ mes</span>
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--mantine-color-dimmed)]">Incluye hasta {plan.includedUnits} unidades · {money(plan.price)} por unidad adicional</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#E6F1EB] px-3 py-1 text-[11.5px] font-semibold text-[#2E7D5B]">14 días gratis</span>
            <span className="rounded-full bg-[var(--mantine-color-body)] px-3 py-1 text-[11.5px] font-semibold text-[var(--mantine-color-dimmed)]">Sin tarjeta</span>
          </div>
          <hr className="border-[var(--mantine-color-default-border)]" />
          <ul className="flex flex-col gap-2 text-sm leading-relaxed">
            {plan.features.map(feature => <li key={feature} className="flex gap-2"><span aria-hidden="true" className="text-[var(--mantine-color-teal-4)]">✓</span>{feature}</li>)}
          </ul>
          <hr className="border-[var(--mantine-color-default-border)]" />
          {step === 1 && units > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-xl bg-[var(--mantine-color-body)] px-4 py-3.5 text-[13px]">
              <div className="flex justify-between gap-3 text-[var(--mantine-color-dimmed)]"><span>{baseLine}</span><span>{money(pricing.base)}</span></div>
              {pricing.extra > 0 && <div className="flex justify-between gap-3 text-[var(--mantine-color-dimmed)]"><span>{extraLine}</span><span>{money(pricing.extraCost)}</span></div>}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Total mensual</strong><strong className="font-display text-xl font-semibold">{total}</strong></div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-between gap-2 text-[13px] text-[var(--mantine-color-dimmed)]"><span>Total mensual</span><span className="text-[var(--mantine-color-placeholder)]">al indicar las unidades</span></div>
          )}
          <p className="text-xs leading-relaxed text-[var(--mantine-color-dimmed)]">{step === 1 ? 'Hoy no se cobra nada. ' : ''}Puedes cambiar de plan en el paso 3.</p>
        </>
      ) : (
        <>
          <div className="flex justify-between gap-3 text-[13px] text-[var(--mantine-color-dimmed)]"><span>{baseLine}</span><span>{money(pricing.base)}</span></div>
          {pricing.extra > 0 && <div className="flex justify-between gap-3 text-[13px] text-[var(--mantine-color-dimmed)]"><span>{extraLine}</span><span>{money(pricing.extraCost)}</span></div>}
          <div className="flex justify-between gap-3 text-[13px]"><span className="text-[var(--mantine-color-dimmed)]">Prueba gratuita</span><strong className="text-[#2E7D5B]">14 días</strong></div>
          <hr className="border-[var(--mantine-color-default-border)]" />
          <div className="flex items-center justify-between gap-3"><strong className="text-[15px]">Hoy</strong><strong className="font-display text-3xl font-semibold text-[#2E7D5B]">S/ 0</strong></div>
          <div className="rounded-xl bg-[var(--mantine-color-body)] px-4 py-3.5">
            <p className="text-[13px]">Después de la prueba</p>
            <strong className="my-1.5 block font-display text-lg font-semibold">{total} al mes</strong>
            <p className="text-xs text-[var(--mantine-color-dimmed)]">Desde el {trialEnd}</p>
          </div>
          <p className="text-xs leading-relaxed text-[var(--mantine-color-dimmed)]">Para continuar después de la prueba, paga por transferencia, Yape o Plin. No se realizarán cobros automáticos.</p>
        </>
      )}
    </div>
  )
}
