import { NextRequest } from 'next/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { requireCapability } from '@/lib/auth/require-capability'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim()
  if (!organizationId) {
    return jsonError('organizationId is required', 400)
  }

  const gate = await requireCapability('users.view', organizationId)
  if (!gate.ok) {
    return jsonError(gate.error, gate.status)
  }

  const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const roleFilter = request.nextUrl.searchParams.get('role')?.trim()
  const statusFilter = request.nextUrl.searchParams.get('status')?.trim()

  if (!isAdminClientConfigured()) {
    return jsonError('Admin API not configured', 503)
  }

  const admin = createAdminClient()
  let query = admin
    .from('user_organization_members')
    .select('id, user_id, organization_id, role, status, invited_at, joined_at, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (roleFilter) {
    query = query.eq('role', roleFilter)
  }
  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: members, error } = await query
  if (error) {
    return jsonError(error.message, 500)
  }

  const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)))
  const profilesById = new Map<string, Record<string, unknown>>()

  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('*').in('id', userIds)
    for (const p of profiles ?? []) {
      profilesById.set(p.id as string, p as Record<string, unknown>)
    }
  }

  const rows = (members ?? [])
    .map((m) => {
      const profile = profilesById.get(m.user_id) ?? {}
      const email = String(profile.email ?? '').toLowerCase()
      const fullName = String(profile.full_name ?? '')
      return {
        membershipId: m.id,
        userId: m.user_id,
        organizationId: m.organization_id,
        role: m.role,
        status: m.status ?? 'active',
        invitedAt: m.invited_at,
        joinedAt: m.joined_at ?? m.created_at,
        email,
        fullName,
        accountStatus: profile.account_status ?? 'active',
        departmentScope: profile.department_scope ?? null,
      }
    })
    .filter((row) => {
      if (!q) return true
      return row.email.includes(q) || row.fullName.toLowerCase().includes(q)
    })

  return jsonOk({ users: rows })
}
