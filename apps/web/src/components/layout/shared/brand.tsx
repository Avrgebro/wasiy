import { useTranslation } from 'react-i18next'

type BrandProps = {
  productAreaKey?: string
}

export function Brand({ productAreaKey }: BrandProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex items-center gap-2.5 px-3 pb-5">
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--mantine-primary-color-5)] to-[var(--mantine-primary-color-8)] text-sm font-bold text-white"
      >
        W
      </div>
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
