'use client'

import { use } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { AuthShell } from '@/components/brand/auth-shell'
import { StatusDot } from '@/components/brand/ui'

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = use(searchParams)
  const { tr } = useI18n()

  return (
    <AuthShell>
      <StatusDot tone="critical" size={10} />
      <h1 className="mt-5 text-content text-title" style={{ fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
        {tr('Sorry, something went wrong.')}
      </h1>
      <p className="mt-3 text-[14px] text-content-soft">
        {params?.error ? tr('Error code: {code}', { code: params.error }) : tr('An unspecified error occurred.')}
      </p>
      <Link href="/auth/login" className="g-btn g-btn--outline mt-8 w-full" style={{ height: 44, padding: '0 24px' }}>
        {tr('Back to sign in')}
      </Link>
    </AuthShell>
  )
}
