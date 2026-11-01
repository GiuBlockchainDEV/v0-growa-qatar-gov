'use client'

import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useState } from 'react'
import { AuthShell } from '@/components/brand/auth-shell'
import { Button, Field, FormMessage } from '@/components/brand/ui'

export default function Page() {
  const { tr } = useI18n()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/reset-password`

    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })

    setMessage(
      tr('If an account exists for this email, you will receive password reset instructions shortly.')
    )
    setIsLoading(false)
  }

  return (
    <AuthShell>
      <h1 className="text-content text-title" style={{ fontWeight: 500 }}>
        {tr('Reset password')}
      </h1>
      <p className="mt-2 text-[14px] text-content-soft">
        {tr('Enter your email address. We will send a secure link if the account exists.')}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field
          id="email"
          label={tr('Email address')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormMessage tone="success">{message}</FormMessage>

        <Button type="submit" fullWidth disabled={isLoading}>
          {isLoading ? tr('Sending…') : tr('Send reset link')}
        </Button>
      </form>

      <p className="mt-8 text-[14px] text-content-soft">
        <Link href="/auth/login" className="text-sage-700 font-medium">
          {tr('Back to sign in')}
        </Link>
      </p>
    </AuthShell>
  )
}
