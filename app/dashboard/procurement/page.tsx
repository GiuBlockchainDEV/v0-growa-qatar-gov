import type { Metadata } from 'next'
import { NfiiOperationsWorkspace } from '@/components/dashboard/nfii-ops/operations-workspace'

export const metadata: Metadata = {
  title: 'Procurement | NFII',
  description: 'Supplier qualification, approved contracts and purchase orders',
}

export default function Page() {
  return <NfiiOperationsWorkspace focus="procurement" />
}
