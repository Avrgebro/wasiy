import { useTranslation } from 'react-i18next'

type BrandProps = {
  productAreaKey?: string
}

export function Brand({ productAreaKey }: BrandProps) {
  const { t } = useTranslation('common')

  return (
    <div className="px-3 pb-5">
      <p className="text-lg font-bold text-[var(--mantine-color-text)]">Wasiy</p>
      {productAreaKey ? (
        <p className="text-sm text-[var(--mantine-color-dimmed)]">
          {t(productAreaKey)}
        </p>
      ) : null}
    </div>
  )
}

