'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/lib/i18n'
import { useActiveOrganizationOptional } from '@/contexts/active-organization-context'
import { Card, PageBody, PageHeader } from '@/components/brand/layout'
import { Button, Field, FormMessage, PasswordField } from '@/components/brand/ui'

export default function AccountPage() {
  const { tr } = useI18n()
  const { user, logout } = useAuth()
  const activeOrg = useActiveOrganizationOptional()
  const [fullName, setFullName] = useState('')
  const [accountStatus, setAccountStatus] = useState('active')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    fetch('/api/account/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.full_name) setFullName(data.profile.full_name)
        if (data.accountStatus) setAccountStatus(data.accountStatus)
      })
      .catch(() => undefined)

    const supabase = createClient()
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.some((f) => f.status === 'verified') ?? false
      setMfaEnabled(verified)
    })
  }, [])

  const saveProfile = async () => {
    setError(null)
    setMessage(null)
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? tr('Update failed'))
      return
    }
    setMessage(tr('Profile updated'))
  }

  const changePassword = async () => {
    setError(null)
    const supabase = createClient()
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
    if (pwError) {
      setError(pwError.message)
      return
    }
    setNewPassword('')
    setMessage(tr('Password updated'))
  }

  const enrollMfa = async () => {
    if (process.env.NEXT_PUBLIC_FEATURE_MFA !== 'true') {
      setError(tr('MFA is not enabled in this environment'))
      return
    }
    const supabase = createClient()
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollError || !data) {
      setError(enrollError?.message ?? tr('MFA enrollment failed'))
      return
    }
    setMessage(tr('Scan the QR code in your authenticator app, then verify in Supabase Auth settings.'))
    void data
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader title={tr('Account')} subtitle={tr('Profile, security, and memberships')} />

        <Card title={tr('Profile')} className="mb-4">
          <div className="space-y-4 p-4">
            <p className="text-[13px] text-content-soft">{user?.email}</p>
            <Field id="fullName" label={tr('Full name')} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <p className="text-[13px] text-content-soft">
              {tr('Account status')}: {accountStatus}
            </p>
            <Button onClick={() => void saveProfile()}>{tr('Save profile')}</Button>
          </div>
        </Card>

        <Card title={tr('Password')} className="mb-4">
          <div className="space-y-4 p-4">
            <PasswordField
              id="new-password"
              label={tr('New password')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Button onClick={() => void changePassword()} disabled={newPassword.length < 8}>
              {tr('Change password')}
            </Button>
          </div>
        </Card>

        <Card title={tr('Multi-factor authentication')} className="mb-4">
          <div className="p-4 space-y-3">
            <p className="text-[13px] text-content-soft">
              {mfaEnabled ? tr('MFA is enabled on your account') : tr('MFA is not enrolled')}
            </p>
            <Button variant="outline" onClick={() => void enrollMfa()}>
              {tr('Enroll authenticator app')}
            </Button>
          </div>
        </Card>

        <Card title={tr('Organizations')}>
          <ul className="divide-y divide-line">
            {(activeOrg?.memberships ?? []).map((m) => (
              <li key={m.organizationId} className="px-4 py-3 text-[14px] flex justify-between">
                <span>{m.organizationId}</span>
                <span className="text-content-soft">
                  {m.role} · {m.status ?? 'active'}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <FormMessage tone={message ? 'success' : 'error'}>{message ?? error}</FormMessage>

        <div className="mt-6">
          <Button variant="outline" onClick={() => void logout()}>
            {tr('Log out')}
          </Button>
        </div>
      </PageBody>
    </div>
  )
}
