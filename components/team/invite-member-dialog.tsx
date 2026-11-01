'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Button, Field, FormMessage, Modal, Textarea } from '@/components/brand/ui'

export function InviteMemberDialog({
  open,
  onClose,
  organizationId,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  organizationId: string
  onInvited?: () => void
}) {
  const { tr } = useI18n()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [departmentScope, setDepartmentScope] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const submit = async () => {
    setIsLoading(true)
    setError(null)
    setDevLink(null)

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          email,
          role,
          departmentScope: departmentScope || null,
          message: message || null,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        delivery?: { sent: boolean; devMessage?: string }
        devInviteUrl?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? tr('Invitation failed'))
      }
      if (data.devInviteUrl) {
        setDevLink(data.devInviteUrl)
      }
      if (data.delivery && !data.delivery.sent && data.delivery.devMessage) {
        setError(data.delivery.devMessage)
      }
      onInvited?.()
      if (data.delivery?.sent) {
        onClose()
        setEmail('')
        setMessage('')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tr('Invitation failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={tr('Invite member')}>
      <div className="space-y-4">
        <Field
          id="invite-email"
          label={tr('Email address')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          id="invite-role"
          label={tr('Role')}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <Field
          id="invite-scope"
          label={tr('Department or scope (optional)')}
          value={departmentScope}
          onChange={(e) => setDepartmentScope(e.target.value)}
        />
        <Textarea
          id="invite-message"
          label={tr('Message (optional)')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <FormMessage tone="error">{error}</FormMessage>
        {devLink && (
          <p className="text-[12px] text-content-soft break-all">
            {tr('Development invitation link')}: {devLink}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {tr('Cancel')}
          </Button>
          <Button disabled={isLoading || !email.trim()} onClick={() => void submit()}>
            {isLoading ? tr('Sending…') : tr('Send invitation')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
