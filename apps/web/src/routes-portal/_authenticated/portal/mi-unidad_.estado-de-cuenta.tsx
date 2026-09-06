import { createFileRoute } from '@tanstack/react-router'
import { PortalLedgerPage } from '../../../features/portal/portal-ledger-page'

export const Route = createFileRoute('/_authenticated/portal/mi-unidad_/estado-de-cuenta')({
  component: PortalLedgerPage,
})
