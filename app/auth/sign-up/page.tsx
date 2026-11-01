'use client'

import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthShell } from '@/components/brand/auth-shell'
import { Button, Field, FormMessage, LatticeLoader, Textarea } from '@/components/brand/ui'

export default function Page() {
  const { tr } = useI18n()
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: `${email ? `Contact: ${email}. ` : ''}${note}` }),
      })
      const data = (await res.json()) as { error?: string; message?: string; submitted?: boolean }
      if (!res.ok) {
        throw new Error(data.error ?? tr('An error occurred'))
      }
      setMessage(
        data.message ??
          tr('Your request was submitted. An administrator will review it. Accounts are invitation-only.')
      )
      setTimeout(() => router.push('/auth/login'), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tr('An error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      claim="Grow Beyond Average."
      intro={tr('Request access to Qatar’s agricultural operations platform. New accounts require an administrator invitation.')}
    >
      <h1 className="text-content text-title" style={{ fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
        {tr('Request access')}
      </h1>
      <p className="mt-2 text-[14px] text-content-soft">
        {tr('Public registration is disabled. Submit a request or use an invitation link from your organization.')}
      </p>

      <form onSubmit={handleRequestAccess} className="mt-8 space-y-5">
        <Field
          id="email"
          label={tr('Email address')}
          type="email"
          autoComplete="email"
          placeholder="operator@growa.qa"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Textarea
          id="note"
          label={tr('Message (optional)')}
          placeholder={tr('Organization name, role, or reason for access')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />

        <FormMessage tone={message ? 'success' : 'error'}>{message ?? error}</FormMessage>

        <Button type="submit" fullWidth disabled={isLoading} aria-busy={isLoading || undefined}>
          {isLoading ? (
            <>
              <LatticeLoader className="text-cream scale-75" label={tr('Submitting')} />
              {tr('Submitting…')}
            </>
          ) : (
            tr('Submit access request')
          )}
        </Button>
      </form>

      <p className="mt-6 text-[13px] text-content-soft">
        <Link href="/auth/invite" className="text-sage-700 hover:text-ink font-medium">
          {tr('I have an invitation link')}
        </Link>
      </p>

      <hr className="growa-dotted-rule my-8" />

      <p className="text-[14px] text-content-soft">
        {tr('Already have an account?')}{' '}
        <Link href="/auth/login" className="text-sage-700 hover:text-ink font-medium transition-colors">
          {tr('Sign in')}
        </Link>
      </p>
    </AuthShell>
  )
}
