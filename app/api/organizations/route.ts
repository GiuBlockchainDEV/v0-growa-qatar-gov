import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { buildSessionContext } from '@/lib/auth/authorization-service'
import { authorize } from '@/lib/auth/authorization'
import { organizationTypesForCreator } from '@/lib/auth/organization-types'
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin'

export async function GET() {
  const session = await buildSessionContext({})
  if (!session.payload) {
    return jsonError('Unauthorized', session.status)
  }

  const canProvision = authorize(session.payload.authorization, 'platform.organizations.provision')
  const canView = authorize(session.payload.authorization, 'organizations.view')

  if (!canView && !canProvision) {
    return jsonError('Forbidden', 403)
  }

  if (!isAdminClientConfigured()) {
    return jsonError('Organizations API not configured', 503)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organizations')
    .select('id, name, slug, description, organization_type, type, created_at, is_active')
    .order('name')

  if (error) {
    return jsonError(error.message, 500)
  }

  return jsonOk({ organizations: data ?? [] })
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string
    slug?: string
    description?: string
    orgType?: string
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonError('Unauthorized', 401)
  }

  const session = await buildSessionContext({})
  if (!session.payload) {
    return jsonError('Unauthorized', 401)
  }

  const isPlatform = Boolean(session.payload.authorization.platformStaffTier)
  const allowedTypes = organizationTypesForCreator(isPlatform)
  const orgType = (body.orgType ?? 'private').trim()

  if (!allowedTypes.some((option) => option.value === orgType)) {
    return jsonError('Organization type not permitted for your account', 403)
  }

  const { data, error } = await supabase.rpc('create_organization_with_owner', {
    org_name: body.name,
    org_slug: body.slug,
    org_description: body.description ?? null,
    org_type: orgType,
  })

  if (error) {
    return jsonError(error.message, 500)
  }

  const row = Array.isArray(data) ? data[0] : data
  return jsonOk({ organizationId: row?.organization_id ?? row })
}
