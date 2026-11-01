import { NextResponse } from 'next/server'
import { buildSessionContext } from '@/lib/auth/authorization-service'
import { resolveActiveMembership } from '@/lib/auth/authorization'
import { writeSecurityAudit } from '@/lib/auth/audit-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { organizationId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : ''
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const session = await buildSessionContext({ requestedOrganizationId: organizationId })
  if (!session.payload) {
    return NextResponse.json({ error: session.error || 'Unauthorized' }, { status: session.status })
  }

  const membership = resolveActiveMembership(session.payload.memberships, organizationId)
  if (!membership) {
    return NextResponse.json({ error: 'Organization membership not found or inactive' }, { status: 403 })
  }

  const refreshed = await buildSessionContext({
    requestedOrganizationId: organizationId,
    persistedOrganizationId: organizationId,
  })

  if (!refreshed.payload) {
    return NextResponse.json({ error: 'Unable to refresh session context' }, { status: 500 })
  }

  await writeSecurityAudit({
    actorId: session.payload.userId,
    organizationId,
    action: 'organization_switched',
    resourceType: 'organization',
    resourceId: organizationId,
  })

  return NextResponse.json({
    activeOrganizationId: organizationId,
    permissions: Array.from(refreshed.payload.authorization.permissions),
    effectiveOrgRole: refreshed.payload.authorization.effectiveOrgRole,
    requiresOrganizationSelection: false,
  })
}
