# Growa Qatar - Row Level Security Strategy

**Step 1.6: RLS strategy definition**

## Core Principles

1. **Default Deny**: All tables deny access unless explicitly granted
2. **RLS Everywhere**: Every table with tenant/operational data has RLS enabled
3. **Membership-Based**: Access derived from user's organization memberships
4. **Readable Policies**: Policies should be understandable and testable
5. **Service Role Bypass**: Admin operations use service role (bypasses RLS)

## RLS Helper Functions

These functions simplify policy definitions and improve readability.

### get_user_id()

Returns the current authenticated user's ID.

```sql
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid()
$$;
```

### get_user_organization_ids()

Returns array of organization IDs the user is an active member of.

```sql
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(organization_id)
  FROM memberships
  WHERE profile_id = auth.uid()
    AND status = 'active'
$$;
```

### is_org_member(org_id)

Checks if user is an active member of the specified organization.

```sql
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE profile_id = auth.uid()
      AND organization_id = org_id
      AND status = 'active'
  )
$$;
```

### is_org_admin(org_id)

Checks if user is an admin of the specified organization.

```sql
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    JOIN role_templates rt ON rt.id = m.role_template_id
    WHERE m.profile_id = auth.uid()
      AND m.organization_id = org_id
      AND m.status = 'active'
      AND rt.is_admin = TRUE
  )
$$;
```

### has_permission(org_id, domain, action)

Checks if user has a specific permission in an organization.

```sql
CREATE OR REPLACE FUNCTION public.has_permission(
  org_id UUID,
  domain TEXT,
  action TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    JOIN role_templates rt ON rt.id = m.role_template_id
    WHERE m.profile_id = auth.uid()
      AND m.organization_id = org_id
      AND m.status = 'active'
      AND rt.permissions->domain ? action
  )
$$;
```

### is_in_scope(membership_id, entity_type, entity_id)

Checks if an entity is within the user's scope assignment.

```sql
CREATE OR REPLACE FUNCTION public.is_in_scope(
  membership_id UUID,
  entity_type TEXT,
  entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
AS $$
DECLARE
  scope JSONB;
  scope_ids UUID[];
BEGIN
  SELECT scope_assignments INTO scope
  FROM memberships
  WHERE id = membership_id;
  
  -- Check direct entity access
  IF scope->'objects'->>(entity_type || '_ids') IS NOT NULL THEN
    scope_ids := ARRAY(SELECT jsonb_array_elements_text(scope->'objects'->(entity_type || '_ids'))::UUID);
    IF entity_id = ANY(scope_ids) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Check geographic scope (simplified - actual implementation needs hierarchy)
  IF scope->'geographic'->>'type' = 'country' THEN
    RETURN TRUE; -- Country-wide access
  END IF;
  
  -- Add region/farm hierarchy checks as needed
  RETURN FALSE;
END;
$$;
```

---

## Table-Specific RLS Policies

### profiles

Users can read/update their own profile.

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins can read profiles in their org
CREATE POLICY "Admins can read org profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.organization_id = m2.organization_id
    JOIN role_templates rt ON rt.id = m1.role_template_id
    WHERE m1.profile_id = auth.uid()
      AND m2.profile_id = profiles.id
      AND m1.status = 'active'
      AND rt.is_admin = TRUE
  )
);
```

---

### organizations

Users can read organizations they're members of.

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can read their organizations
CREATE POLICY "Members can read org"
ON organizations FOR SELECT
USING (is_org_member(id));

-- Only service role can insert/update/delete
-- (handled by Edge Functions)
```

---

### departments

Users can read departments in their organizations.

```sql
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Members can read departments in their org
CREATE POLICY "Members can read org departments"
ON departments FOR SELECT
USING (is_org_member(organization_id));
```

---

### memberships

Users can read their own memberships; admins can manage org memberships.

```sql
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Users can read their own memberships
CREATE POLICY "Users can read own memberships"
ON memberships FOR SELECT
USING (profile_id = auth.uid());

-- Admins can read org memberships
CREATE POLICY "Admins can read org memberships"
ON memberships FOR SELECT
USING (is_org_admin(organization_id));

-- Only service role can modify memberships
-- (invitation acceptance, role changes via Edge Functions)
```

---

### invitations

Admins can manage invitations; invitees can read their own.

```sql
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins can read org invitations
CREATE POLICY "Admins can read org invitations"
ON invitations FOR SELECT
USING (is_org_admin(organization_id));

-- Invitees can read their pending invitations (by email)
-- Note: This requires matching against auth.jwt()->>'email'
CREATE POLICY "Invitees can read own invitations"
ON invitations FOR SELECT
USING (
  email = (auth.jwt()->>'email')
  AND status = 'pending'
);

-- Only service role can insert/update invitations
```

---

### audit_logs

Admins can read org logs; users can see their own actions.

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit entries
CREATE POLICY "Users can read own audit logs"
ON audit_logs FOR SELECT
USING (actor_id = auth.uid());

-- Admins can read org audit logs
CREATE POLICY "Admins can read org audit logs"
ON audit_logs FOR SELECT
USING (is_org_admin(organization_id));

-- Only service role can insert audit logs
-- (all writes go through server-side logging)
```

---

### role_templates

All authenticated users can read role templates (public reference data).

```sql
ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read role templates
CREATE POLICY "Authenticated users can read role templates"
ON role_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only service role can modify role templates
```

---

### country_instances, branding_configs, legal_label_sets, regions

Reference data readable by authenticated users.

```sql
-- country_instances
ALTER TABLE country_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read country instances"
ON country_instances FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- branding_configs
ALTER TABLE branding_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read branding"
ON branding_configs FOR SELECT
USING (
  -- Country-level branding
  (country_instance_id IS NOT NULL) OR
  -- Org-level branding for members
  (organization_id IS NOT NULL AND is_org_member(organization_id))
);

-- legal_label_sets
ALTER TABLE legal_label_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read legal labels"
ON legal_label_sets FOR SELECT
USING (auth.uid() IS NOT NULL);

-- regions
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read regions"
ON regions FOR SELECT
USING (auth.uid() IS NOT NULL);
```

---

## Service Role Boundaries

The service role (via `SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS and should only be used for:

### Allowed Operations (Server-Side Only)

| Operation | Why Service Role |
|-----------|------------------|
| Create invitation | Privileged admin action |
| Accept invitation | Creates profile + membership atomically |
| Change user status | Suspend, revoke require audit |
| Change user role | Requires validation + audit |
| Write audit logs | Must not be user-modifiable |
| System maintenance | Migrations, cleanup tasks |

### Never Use Service Role For

| Operation | Why Not |
|-----------|---------|
| Normal data reads | Use user's RLS-protected access |
| User profile updates | User can update via RLS |
| General queries | Defeats purpose of RLS |

### Edge Function Pattern

```typescript
// In Supabase Edge Function
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Bypasses RLS
)

// Validate the request first
const authHeader = req.headers.get('Authorization')
const { data: { user }, error } = await adminClient.auth.getUser(
  authHeader?.replace('Bearer ', '')
)

if (!user) {
  return new Response('Unauthorized', { status: 401 })
}

// Check if user has permission for this action
const canInvite = await checkPermission(user.id, 'users', 'invite')
if (!canInvite) {
  return new Response('Forbidden', { status: 403 })
}

// Now perform the privileged operation
const { data, error } = await adminClient
  .from('invitations')
  .insert({ ... })
```

---

## Testing RLS Policies

### Test Matrix

For each table, test these scenarios:

| Role | Own Data | Same Org | Other Org | Expected |
|------|----------|----------|-----------|----------|
| User | Read | Deny | Deny | Pass |
| Admin | Read | Read | Deny | Pass |
| Service | Read | Read | Read | Pass |

### Test Queries

```sql
-- Test as specific user
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Try to read profiles
SELECT * FROM profiles;

-- Reset
RESET role;
RESET request.jwt.claims;
```

---

## Denial Defaults

All tables start with RLS enabled and no policies, meaning:

```sql
-- Default state after enabling RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- With no policies, all access is DENIED
-- This is the safe default
```

Policies are then added explicitly to grant specific access patterns.

---

## Policy Naming Convention

```
"{who} can {action} {what}"
```

Examples:
- "Users can read own profile"
- "Admins can read org memberships"
- "Members can read org departments"
- "Authenticated users can read role templates"
