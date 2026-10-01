'use client'

import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthShell } from '@/components/brand/auth-shell'
import { Button, Field, FormMessage, LatticeLoader, PasswordField } from '@/components/brand/ui'

export default function Page() {
  const { tr } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/dashboard')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tr('An error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-content text-title" style={{ fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
        {tr('Welcome back')}
      </h1>
      <p className="mt-2 text-[14px] text-content-soft">
        {tr('Enter your credentials to access the platform.')}
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-5" noValidate={false}>
        <Field
          id="email"
          label={tr('Email address')}
          type="email"
          autoComplete="email"
          placeholder="operator@growa.qa"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <PasswordField
            id="password"
            label={tr('Password')}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Link href="/auth/error" className="text-[12px] text-sage-700 hover:text-ink transition-colors">
              {tr('Forgot password?')}
            </Link>
          </div>
        </div>

        <FormMessage>{error}</FormMessage>

        {/* A primary button that is busy keeps its fill: the loader inside
            says "working", an outline would say "unavailable". */}
        <Button type="submit" fullWidth disabled={isLoading} aria-busy={isLoading || undefined}>
          {isLoading ? (
            <>
              <LatticeLoader className="text-cream scale-75" label={tr('Signing in')} />
              {tr('Signing in…')}
            </>
          ) : (
            tr('Access platform')
          )}
        </Button>
      </form>

      <hr className="growa-dotted-rule my-8" />

      <p className="text-[14px] text-content-soft">
        {tr('Don’t have an account?')}{' '}
        <Link href="/auth/sign-up" className="text-sage-700 hover:text-ink font-medium transition-colors">
          {tr('Request access')}
        </Link>
      </p>
    </AuthShell>
  )
}
