import type { Metadata } from 'next'
import { NfiiOperationsWorkspace } from '@/components/dashboard/nfii-ops/operations-workspace'

export const metadata: Metadata = {
  title: 'Strategic Reserves | NFII',
  description: 'Warehouse, batch and reserve release operations',
}

export default function Page() {
  return <NfiiOperationsWorkspace focus="reserves" />
}
