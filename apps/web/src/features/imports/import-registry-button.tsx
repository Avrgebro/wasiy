import { Button } from '@mantine/core'
import { Import } from '@solar-icons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { canManageRegistry } from '../auth/access'
import { useMe } from '../auth/hooks'

/**
 * Imports are an action on a dataset rather than a place, so they are reached
 * from the pages whose records they load instead of from the sidebar. Renders
 * nothing for roles that cannot write to the registry.
 */
export function ImportRegistryButton() {
  const { t } = useTranslation('common')
  const meQuery = useMe()

  if (!meQuery.data || !canManageRegistry(meQuery.data)) {
    return null
  }

  return (
    <Button
      component={Link}
      leftSection={<Import size={16} />}
      to="/admin/registry/imports"
      variant="light"
    >
      {t('actions.import')}
    </Button>
  )
}
