import { NextResponse } from 'next/server'
import { buildSessionContext } from '@/lib/auth/authorization-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedOrganizationId = searchParams.get('organizationId')
  const persistedOrganizationId = request.headers.get('x-growa-active-organization-id')

  const result = await buildSessionContext({
    requestedOrganizationId,
    persistedOrganizationId,
  })

  if (!result.payload) {
    return NextResponse.json({ error: result.error || 'Unauthorized' }, { status: result.status })
  }

  const { authorization, ...rest } = result.payload

  return NextResponse.json({
    ...rest,
    permissions: Array.from(authorization.permissions),
    effectiveOrgRole: authorization.effectiveOrgRole,
    platformStaffTier: authorization.platformStaffTier,
  })
}
