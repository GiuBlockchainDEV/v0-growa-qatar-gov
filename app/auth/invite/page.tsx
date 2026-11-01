'use client'

import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AuthShell } from '@/components/brand/auth-shell'
import { Button, FormMessage, LatticeLoader, PasswordField, PasswordStrength } from '@/components/brand/ui'

interface InvitePreview {
  organizationName: string
  email: string
  role: string
  message: string | null
  canAccept: boolean
  expired: boolean
}

function InviteContent() {
  const { tr } = useI18n()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const router = useRouter()

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError(tr('Invalid invitation link'))
      setIsLoading(false)
      return
    }

    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error ?? tr('Invalid invitation'))
          return
        }
        setPreview(data as InvitePreview)
      })
      .catch(() => setLoadError(tr('Unable to load invitation')))
      .finally(() => setIsLoading(false))
  }, [token, tr])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setNeedsPassword(!data.session)
    })
  }, [])

  const acceptInvitation = async () => {
    setActionError(null)
    setIsSubmitting(true)
    const supabase = createClient()

    try {
      if (needsPassword && preview?.email) {
        if (password.length < 8) {
          throw new Error(tr('Password must be at least 8 characters'))
        }
        const { error: signError } = await supabase.auth.signUp({
          email: preview.email,
          password,
          options: {
            data: { full_name: fullName.trim() || undefined },
            emailRedirectTo: `${window.location.origin}/auth/invite?token=${encodeURIComponent(token)}`,
          },
        })
        if (signError && !signError.message.includes('already registered')) {
          throw signError
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: preview.email,
          password,
        })
        if (signInError) throw signInError
      }

      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? tr('Unable to accept invitation'))
      }

      if (fullName.trim()) {
        await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
      }

      router.push('/dashboard')
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : tr('An error occurred'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <AuthShell>
        <LatticeLoader label={tr('Loading invitation')} />
      </AuthShell>
    )
  }

  if (loadError || !preview) {
    return (
      <AuthShell>
        <FormMessage>{loadError ?? tr('Invalid invitation')}</FormMessage>
        <p className="mt-6 text-[14px]">
          <Link href="/auth/login" className="text-sage-700 font-medium">
            {tr('Sign in')}
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="text-content text-title" style={{ fontWeight: 500 }}>
        {tr('Organization invitation')}
      </h1>
      <p className="mt-2 text-[14px] text-content-soft">
        {tr('You have been invited to join')} <strong>{preview.organizationName}</strong> {tr('as')}{' '}
        <strong>{preview.role}</strong>.
      </p>
      {preview.message && (
        <p className="mt-4 text-[14px] text-content-soft border-s-2 border-line ps-4">{preview.message}</p>
      )}

      {!preview.canAccept && (
        <FormMessage>{preview.expired ? tr('This invitation has expired') : tr('This invitation is no longer valid')}</FormMessage>
      )}

      {preview.canAccept && (
        <div className="mt-8 space-y-5">
          {needsPassword && (
            <>
              <input
                className="w-full h-11 border border-line-strong px-4 text-[14px]"
                placeholder={tr('Full name')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <div>
                <PasswordField
                  id="password"
                  label={tr('Password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <PasswordStrength password={password} />
              </div>
            </>
          )}

          <FormMessage>{actionError}</FormMessage>

          <Button fullWidth disabled={isSubmitting} onClick={() => void acceptInvitation()}>
            {isSubmitting ? tr('Accepting…') : tr('Accept invitation')}
          </Button>
        </div>
      )}
    </AuthShell>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<AuthShell><LatticeLoader label="Loading" /></AuthShell>}>
      <InviteContent />
    </Suspense>
  )
}
