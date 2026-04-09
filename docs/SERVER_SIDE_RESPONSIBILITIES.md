# Growa Qatar - Server-Side Responsibilities

**Step 1.7: Privileged server-side responsibilities definition**

## Decision Matrix

| Responsibility | Vercel Server | Edge Function | Client | Reason |
|---------------|---------------|---------------|--------|--------|
| User invitation | - | **Primary** | Never | Privileged, needs token generation |
| Invitation acceptance | - | **Primary** | Never | Creates profile atomically |
| User suspension/revocation | - | **Primary** | Never | Privileged admin action |
| Role changes | - | **Primary** | Never | Security-sensitive |
| Audit log writes | - | **Primary** | Never | Must not be user-modifiable |
| Password reset trigger | - | Supabase Auth | Never | Built-in Supabase flow |
| Sign in/out | - | Supabase Auth | Trigger | Client triggers, Auth handles |
| Profile updates | **Middleware** | - | Allowed | RLS-protected, audit middleware |
| Data reads | **RSC/Actions** | - | Fallback | RLS-protected |
| Form submissions | **Actions** | - | Never | Validation + audit |
| Report generation | **Actions** | - | Never | May need service role |
| Webhooks | - | **Primary** | Never | External integrations |

## Vercel Server Handlers

### Server Components (RSC)

Use for: Initial data fetching, page rendering with user context.

```typescript
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Fetches with RLS - user only sees allowed data
  const { data: organizations } = await supabase
    .from('organizations')
    .select('*')
  
  return <Dashboard organizations={organizations} />
}
```

**Audit**: No direct audit needed - RLS ensures data boundaries.

---

### Server Actions

Use for: Form submissions, mutations that need validation + audit.

```typescript
// app/actions/update-profile.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Update profile (RLS-protected)
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name_en: formData.get('full_name_en'),
      full_name_ar: formData.get('full_name_ar'),
    })
    .eq('id', user.id)
  
  if (error) throw error
  
  // Audit log (via admin client)
  const admin = createAdminClient()
  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'profile_updated',
    target_type: 'profile',
    target_id: user.id,
    metadata: { fields_changed: ['full_name_en', 'full_name_ar'] }
  })
  
  revalidatePath('/settings/profile')
}
```

**Audit**: Always log sensitive changes.

---

### Route Handlers

Use for: API endpoints, file uploads, exports.

```typescript
// app/api/reports/export/route.ts
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  // Verify user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check permission
  const hasExportPermission = await checkPermission(user.id, 'reports', 'export')
  if (!hasExportPermission) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Generate report...
  
  // Audit the export
  const admin = createAdminClient()
  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'data_exported',
    target_type: 'report',
    metadata: { report_type: 'organization_summary' }
  })
  
  return Response.json({ download_url: '...' })
}
```

---

### Middleware

Use for: Auth verification, redirect logic, request logging.

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create response to modify
  let response = NextResponse.next({ request })
  
  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  
  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()
  
  // Protect routes
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url))
  }
  
  return response
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
}
```

---

## Supabase Edge Functions

### When to Use Edge Functions

1. **Privileged mutations** that bypass RLS
2. **Token generation** for invitations
3. **External webhooks** from third parties
4. **Background jobs** triggered by database events

### invite-user Function

```typescript
// supabase/functions/invite-user/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hash } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Create admin client
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  
  // Get user from auth header
  const authHeader = req.headers.get('Authorization')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(
    authHeader?.replace('Bearer ', '')
  )
  
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // Parse request body
  const { email, organization_id, role_template_id, department_id } = await req.json()
  
  // Verify inviter has permission
  const { data: membership } = await adminClient
    .from('memberships')
    .select('*, role_templates(*)')
    .eq('profile_id', user.id)
    .eq('organization_id', organization_id)
    .eq('status', 'active')
    .single()
  
  if (!membership?.role_templates?.permissions?.users?.includes('invite')) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Generate secure token
  const token = crypto.randomUUID() + crypto.randomUUID()
  const tokenHash = await hash(token)
  
  // Create invitation
  const { data: invitation, error } = await adminClient
    .from('invitations')
    .insert({
      email,
      organization_id,
      department_id,
      role_template_id,
      invited_by: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
    })
    .select()
    .single()
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
  
  // Audit log
  await adminClient.from('audit_logs').insert({
    actor_id: user.id,
    action: 'user_invited',
    target_type: 'invitation',
    target_id: invitation.id,
    organization_id,
    metadata: { email, role_template_id }
  })
  
  // TODO: Send email with activation link containing token
  // const activationUrl = `${Deno.env.get('APP_URL')}/auth/activate?token=${token}`
  
  return new Response(JSON.stringify({ success: true, invitation_id: invitation.id }))
})
```

---

### activate-account Function

```typescript
// supabase/functions/activate-account/index.ts
serve(async (req) => {
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  
  const { token, password, full_name_en, full_name_ar } = await req.json()
  
  // Find invitation by validating token
  const { data: invitations } = await adminClient
    .from('invitations')
    .select('*')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
  
  // Find matching invitation (compare token hashes)
  let validInvitation = null
  for (const inv of invitations || []) {
    const isValid = await compare(token, inv.token_hash)
    if (isValid) {
      validInvitation = inv
      break
    }
  }
  
  if (!validInvitation) {
    return new Response('Invalid or expired invitation', { status: 400 })
  }
  
  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: validInvitation.email,
    password,
    email_confirm: true,
  })
  
  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 400 })
  }
  
  // Create profile
  await adminClient.from('profiles').insert({
    id: authData.user.id,
    email: validInvitation.email,
    full_name_en,
    full_name_ar,
  })
  
  // Create membership
  await adminClient.from('memberships').insert({
    profile_id: authData.user.id,
    organization_id: validInvitation.organization_id,
    department_id: validInvitation.department_id,
    role_template_id: validInvitation.role_template_id,
    scope_assignments: validInvitation.scope_assignments,
    status: 'active',
    invited_by: validInvitation.invited_by,
    is_primary: true,
  })
  
  // Update invitation status
  await adminClient
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_profile_id: authData.user.id,
    })
    .eq('id', validInvitation.id)
  
  // Audit log
  await adminClient.from('audit_logs').insert({
    actor_id: authData.user.id,
    action: 'user_activated',
    target_type: 'profile',
    target_id: authData.user.id,
    organization_id: validInvitation.organization_id,
  })
  
  return new Response(JSON.stringify({ success: true }))
})
```

---

## Audit Obligations

### Mandatory Audit Events

| Event | When | Required Fields |
|-------|------|-----------------|
| `sign_in` | User signs in | actor_id, ip_address, user_agent |
| `sign_out` | User signs out | actor_id |
| `user_invited` | Admin invites user | actor_id, target email, org, role |
| `user_activated` | User activates account | actor_id (new user), org |
| `user_suspended` | Admin suspends user | actor_id, target_id, reason |
| `user_revoked` | Admin revokes user | actor_id, target_id, reason |
| `role_changed` | Admin changes role | actor_id, target_id, old/new role |
| `scope_changed` | Admin changes scope | actor_id, target_id, old/new scope |
| `password_reset` | User resets password | actor_id |
| `mfa_enabled` | User enables MFA | actor_id |
| `mfa_disabled` | User/admin disables MFA | actor_id, target_id |
| `data_exported` | User exports data | actor_id, export_type, filters |

### Audit Log Schema Reminder

```typescript
interface AuditLog {
  id: string
  actor_id: string | null    // Who performed the action
  action: AuditAction        // What action was performed
  target_type: string | null // Type of entity affected
  target_id: string | null   // ID of entity affected
  organization_id: string | null // Org context
  metadata: Record<string, any>  // Action-specific details
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
```

### Audit Retention

- Production: 7 years (regulatory requirement)
- Staging: 30 days
- Development: 7 days

---

## Client Boundaries

### What Clients CAN Do

- Trigger sign in/sign out (Supabase Auth handles)
- Read data (RLS-protected)
- Submit forms (via Server Actions)
- Update own profile (RLS-protected)

### What Clients CANNOT Do

- Create users or invitations
- Change user status (suspend/revoke)
- Change user roles or scopes
- Write audit logs
- Access other users' data
- Bypass RLS

### Enforcement

1. **RLS**: Database-level enforcement
2. **No direct client writes to privileged tables**
3. **Server Actions validate before mutating**
4. **Edge Functions check permissions explicitly**
