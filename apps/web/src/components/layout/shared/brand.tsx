import { useTranslation } from 'react-i18next'
import { WasiyLogo } from './wasiy-logo'

type BrandProps = {
  className?: string
  productAreaKey?: string
}

export function Brand({ className, productAreaKey }: BrandProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className={
        className ?? 'flex items-center gap-2.5 px-3 pb-5'
      }
    >
      {/* Rule 7: petróleo mark on light, inverted paper on dark. */}
      <WasiyLogo
        className="shrink-0 text-[var(--wa-brand-mark)]"
        size={32}
      />
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight tracking-tight text-[var(--mantine-color-text)]">
          Wasiy
        </p>
        {productAreaKey ? (
          <p className="truncate text-xs text-[var(--mantine-color-dimmed)]">
            {t(productAreaKey)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
