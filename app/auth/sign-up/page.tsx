'use client'

import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthShell } from '@/components/brand/auth-shell'
import {
  Button,
  Field,
  FormMessage,
  LatticeLoader,
  PasswordField,
  PasswordStrength,
  StatusDot,
} from '@/components/brand/ui'

export default function Page() {
  const { tr } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError(tr('Passwords do not match'))
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError(tr('Password must be at least 8 characters'))
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      router.push('/auth/sign-up-success')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : tr('An error occurred'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      claim="Grow Beyond Average."
      intro={tr('Request access to Qatar’s agricultural operations platform: real-time insight into production, resources and supply.')}
    >
      <h1 className="text-content text-title" style={{ fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
        {tr('Request access')}
      </h1>
      <p className="mt-2 text-[14px] text-content-soft">
        {tr('Create your account to join the platform.')}
      </p>

      {/* The brand's bullet is the square data point. */}
      <ul className="mt-6 space-y-2">
        {[
          'Real-time environmental monitoring',
          'Production cycle management',
          'Inventory tracking and analytics',
        ].map((feature) => (
          <li key={feature}>
            <StatusDot tone="good" size={6} label={<span className="text-[13px] text-content-soft">{tr(feature)}</span>} />
          </li>
        ))}
      </ul>

      <form onSubmit={handleSignUp} className="mt-8 space-y-5">
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
            autoComplete="new-password"
            hint={tr('At least 8 characters.')}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>

        <PasswordField
          id="repeat-password"
          label={tr('Confirm password')}
          autoComplete="new-password"
          required
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
        />

        <FormMessage>{error}</FormMessage>

        <Button type="submit" fullWidth disabled={isLoading} aria-busy={isLoading || undefined}>
          {isLoading ? (
            <>
              <LatticeLoader className="text-cream scale-75" label={tr('Creating account')} />
              {tr('Creating account…')}
            </>
          ) : (
            tr('Create account')
          )}
        </Button>

        <p className="text-[12px] text-content-soft">
          {tr('Your data is protected with enterprise-grade encryption.')}
        </p>
      </form>

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
