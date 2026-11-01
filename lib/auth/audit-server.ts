import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'

export type SecurityAuditAction =
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_revoked'
  | 'invitation_resent'
  | 'role_changed'
  | 'account_suspended'
  | 'account_reactivated'
  | 'membership_removed'
  | 'organization_switched'
  | 'privileged_access_granted'
  | 'privileged_access_revoked'
  | 'access_request_submitted'

export interface WriteAuditInput {
  actorId: string | null
  organizationId?: string | null
  action: SecurityAuditAction
  resourceType: string
  resourceId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Append-only security audit row (service role). No-op when service key missing (local dev).
 */
export async function writeSecurityAudit(input: WriteAuditInput): Promise<{ ok: boolean; devSkipped?: boolean }> {
  if (!isAdminClientConfigured()) {
    return { ok: false, devSkipped: true }
  }

  const admin = createAdminClient()
  const row = {
    user_id: input.actorId,
    organization_id: input.organizationId ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    changes: input.metadata ?? {},
    created_at: new Date().toISOString(),
  }

  const { error } = await admin.from('audit_logs').insert(row)
  if (error) {
    console.error('[audit] insert failed:', error.message)
    return { ok: false }
  }
  return { ok: true }
}
