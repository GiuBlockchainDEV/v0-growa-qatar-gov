'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { AuthShell } from '@/components/brand/auth-shell'
import { StatusDot } from '@/components/brand/ui'

export default function SignUpSuccessPage() {
  const { tr } = useI18n()
  return (
    <AuthShell>
      {/* The brand has no emoji and no tick icon: the square data point,
          in sage — the "good" state — says it. */}
      <StatusDot tone="good" size={10} />
      <h1 className="mt-5 text-content text-title" style={{ fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
        {tr('Account created')}
      </h1>
      <p className="mt-3 text-[14px] leading-[1.45] text-content-soft">
        {tr('Your account has been created. Please check your email to verify it.')}
      </p>
      <Link href="/auth/login" className="g-btn g-btn--primary mt-8 w-full" style={{ height: 44, padding: '0 24px' }}>
        {tr('Go to sign in')}
      </Link>
    </AuthShell>
  )
}
