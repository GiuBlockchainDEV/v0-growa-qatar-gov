import type { Metadata } from 'next'
import { NfiiOperationsWorkspace } from '@/components/dashboard/nfii-ops/operations-workspace'

export const metadata: Metadata = {
  title: 'Logistics | NFII',
  description: 'Tracked shipments and documented delivery workflow',
}

export default function Page() {
  return <NfiiOperationsWorkspace focus="logistics" />
}
