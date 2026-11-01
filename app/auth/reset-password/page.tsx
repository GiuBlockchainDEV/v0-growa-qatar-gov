'use client'

import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AuthShell } from '@/components/brand/auth-shell'
import { Button, FormMessage, LatticeLoader, PasswordField, PasswordStrength } from '@/components/brand/ui'

export default function Page() {
  const { tr } = useI18n()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(tr('Password must be at least 8 characters'))
      return
    }
    if (password !== repeat) {
      setError(tr('Passwords do not match'))
      return
    }

    setIsLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/auth/login')
  }

  return (
    <AuthShell>
      <h1 className="text-content text-title" style={{ fontWeight: 500 }}>
        {tr('Choose a new password')}
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <PasswordField
            id="password"
            label={tr('New password')}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>

        <PasswordField
          id="repeat"
          label={tr('Confirm password')}
          autoComplete="new-password"
          required
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />

        <FormMessage>{error}</FormMessage>

        <Button type="submit" fullWidth disabled={isLoading}>
          {isLoading ? (
            <>
              <LatticeLoader className="text-cream scale-75" label={tr('Updating')} />
              {tr('Updating…')}
            </>
          ) : (
            tr('Update password')
          )}
        </Button>
      </form>

      <p className="mt-8 text-[14px] text-content-soft">
        <Link href="/auth/login" className="text-sage-700 font-medium">
          {tr('Sign in')}
        </Link>
      </p>
    </AuthShell>
  )
}
