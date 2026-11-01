import { Suspense } from 'react'
import { LatticeLoader } from '@/components/brand/ui'

export default function UserDetailLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LatticeLoader label="Loading" />}>{children}</Suspense>
}
