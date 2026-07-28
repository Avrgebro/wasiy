import { Alert } from '@mantine/core'
import { CodeSquare } from '@solar-icons/react'
import { useTranslation } from 'react-i18next'

/**
 * Stands in for a page that has a navigation entry but no implementation yet.
 * Deliberately loud: these exist so the sidebar reflects the planned product,
 * and nothing here should reach users without being noticed first.
 */
export function PagePlaceholder({
  descriptionKey,
  titleKey,
}: {
  descriptionKey?: string
  titleKey: string
}) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-[var(--mantine-color-text)]">
        {t(titleKey)}
      </h1>
      <Alert
        color="yellow"
        icon={<CodeSquare size={20} />}
        title={t('placeholder.title')}
      >
        {descriptionKey ? t(descriptionKey) : t('placeholder.body')}
      </Alert>
    </div>
  )
}
