import { requirePermission, type SessionContextPayload } from '@/lib/auth/authorization-service'
import type { PermissionKey } from '@/lib/auth/capabilities'

export async function requireCapability(
  permission: PermissionKey,
  organizationId: string | null | undefined
): Promise<
  | { ok: true; context: SessionContextPayload }
  | { ok: false; status: number; error: string }
> {
  const gate = await requirePermission(permission, organizationId ?? null)
  if (!gate.allowed || !gate.context) {
    return {
      ok: false,
      status: gate.status === 401 ? 401 : 403,
      error: gate.status === 401 ? 'Unauthorized' : 'Forbidden',
    }
  }
  return { ok: true, context: gate.context }
}
