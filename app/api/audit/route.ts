import { NextRequest } from 'next/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { requireCapability } from '@/lib/auth/require-capability'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  if (!organizationId) {
    return jsonError('organizationId is required', 400)
  }

  const gate = await requireCapability('audit.view', organizationId)
  if (!gate.ok) {
    return jsonError(gate.error, gate.status)
  }

  if (!isAdminClientConfigured()) {
    return jsonError('Audit API not configured', 503)
  }

  const admin = createAdminClient()
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 200)

  const { data, error } = await admin
    .from('audit_logs')
    .select('id, user_id, action, resource_type, resource_id, organization_id, changes, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return jsonError(error.message, 500)
  }

  return jsonOk({ events: data ?? [] })
}
