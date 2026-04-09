# Growa Qatar - Auth/Access Database Domain Model

**Step 1.5: Database domain model definition**

## Overview

The auth/access domain manages identity, organizations, roles, permissions, and audit trails. Supabase Auth handles credentials and sessions; application tables handle organizational structure and fine-grained permissions.

## Entity Relationship Diagram

```
┌─────────────────┐
│  auth.users     │ (Supabase Auth - identity root)
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐
│    profiles     │ (Application user data)
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐     ┌─────────────────┐
│  memberships    │────▶│ role_templates  │
└────────┬────────┘     └─────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│ orgs   │ │departments │
└────────┘ └────────────┘
    │
    ▼
┌─────────────────┐
│country_instances│
└─────────────────┘
```

## Table Definitions

### country_instances

Top-level deployment container for each country.

```sql
CREATE TABLE country_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) UNIQUE NOT NULL, -- ISO country code: QA, SA, AE
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  config JSONB DEFAULT '{}', -- Country-specific configuration
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Qatar
INSERT INTO country_instances (code, name_en, name_ar)
VALUES ('QA', 'Qatar', 'قطر');
```

---

### branding_configs

Country and organization branding settings.

```sql
CREATE TABLE branding_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id),
  organization_id UUID REFERENCES organizations(id), -- NULL for country-level
  primary_color VARCHAR(7) NOT NULL, -- Hex color
  secondary_color VARCHAR(7),
  logo_url TEXT,
  favicon_url TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Either country or org, not both
  CONSTRAINT branding_scope CHECK (
    (country_instance_id IS NOT NULL AND organization_id IS NULL) OR
    (country_instance_id IS NULL AND organization_id IS NOT NULL)
  )
);
```

---

### legal_label_sets

Localized legal terminology per country/organization.

```sql
CREATE TABLE legal_label_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id) NOT NULL,
  label_key VARCHAR(100) NOT NULL, -- e.g., 'entity_name', 'ministry_label'
  value_en TEXT NOT NULL,
  value_ar TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(country_instance_id, label_key)
);

-- Example labels for Qatar
-- ('entity_name', 'State of Qatar', 'دولة قطر')
-- ('ministry_label', 'Ministry', 'وزارة')
```

---

### organizations

Entities operating within a country deployment.

```sql
CREATE TYPE organization_type AS ENUM (
  'ministry',
  'sovereign_entity',
  'state_operator',
  'financial_institution',
  'research_entity',
  'external_operator'
);

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id) NOT NULL,
  type organization_type NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL, -- Short code: MOM, HASSAD, QDB
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Examples:
-- ('ministry', 'MOM', 'Ministry of Municipality', 'وزارة البلدية')
-- ('state_operator', 'HASSAD', 'Hassad Food', 'حصاد للأغذية')
-- ('financial_institution', 'QDB', 'Qatar Development Bank', 'بنك قطر للتنمية')
```

---

### departments

Divisions within organizations.

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  parent_department_id UUID REFERENCES departments(id), -- Hierarchical
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, code)
);

-- Example: Ministry of Municipality
-- ('FOOD_SEC', 'Food Security Division', 'قسم الأمن الغذائي')
-- ('AG_INSP', 'Agricultural Inspection', 'التفتيش الزراعي')
```

---

### regions

Geographic regions within a country.

```sql
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  parent_region_id UUID REFERENCES regions(id), -- Hierarchical
  geometry JSONB, -- GeoJSON for boundaries
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(country_instance_id, code)
);

-- Qatar municipalities:
-- ('DOHA', 'Doha', 'الدوحة')
-- ('AL_WAKRAH', 'Al Wakrah', 'الوكرة')
-- ('AL_KHOR', 'Al Khor', 'الخور')
-- ('AL_RAYYAN', 'Al Rayyan', 'الريان')
```

---

### profiles

Application-level user data linked to auth.users.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name_en VARCHAR(200),
  full_name_ar VARCHAR(200),
  phone VARCHAR(20),
  preferred_locale VARCHAR(5) DEFAULT 'en', -- 'en' or 'ar'
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile is created when:
-- 1. User accepts invitation and sets password
-- 2. Linked to auth.users via same UUID
```

---

### memberships

Links users to organizations with roles and scopes.

```sql
CREATE TYPE membership_status AS ENUM (
  'active',
  'pending',
  'suspended',
  'revoked'
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  department_id UUID REFERENCES departments(id), -- Optional
  role_template_id UUID REFERENCES role_templates(id) NOT NULL,
  scope_assignments JSONB DEFAULT '{}', -- Geographic/object scopes
  status membership_status DEFAULT 'pending',
  is_primary BOOLEAN DEFAULT FALSE, -- Default org for user
  invited_by UUID REFERENCES profiles(id),
  status_changed_by UUID REFERENCES profiles(id),
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One membership per user per org
  UNIQUE(profile_id, organization_id)
);
```

**scope_assignments schema:**
```json
{
  "geographic": {
    "type": "region",
    "ids": ["region-uuid-1", "region-uuid-2"],
    "include_children": true
  },
  "objects": {
    "farm_ids": ["farm-uuid-1"],
    "greenhouse_ids": []
  }
}
```

---

### role_templates

Predefined role definitions with permission sets.

```sql
CREATE TABLE role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  permissions JSONB NOT NULL, -- Permission matrix
  is_admin BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE, -- Cannot be deleted
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- See ROLE_PERMISSIONS.md for full list
```

**permissions schema:**
```json
{
  "users": ["read", "invite"],
  "organizations": ["read"],
  "farms": ["read", "write"],
  "alerts": ["read", "acknowledge", "resolve"],
  "inspections": ["read", "write", "complete"],
  "reports": ["read", "export"]
}
```

---

### permission_templates

Granular permission definitions (used by role_templates).

```sql
CREATE TABLE permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(50) NOT NULL, -- 'users', 'farms', 'alerts', etc.
  action VARCHAR(50) NOT NULL, -- 'read', 'write', 'approve', etc.
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  requires_scope BOOLEAN DEFAULT TRUE, -- Must have scope assignment
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(domain, action)
);

-- Examples:
-- ('users', 'invite', 'Invite Users', 'دعوة المستخدمين')
-- ('farms', 'read', 'View Farms', 'عرض المزارع')
-- ('alerts', 'resolve', 'Resolve Alerts', 'حل التنبيهات')
```

---

### invitations

Pending user invitations.

```sql
CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  department_id UUID REFERENCES departments(id),
  role_template_id UUID REFERENCES role_templates(id) NOT NULL,
  scope_assignments JSONB DEFAULT '{}',
  invited_by UUID REFERENCES profiles(id) NOT NULL,
  token_hash VARCHAR(255) NOT NULL, -- bcrypt hash of invitation token
  status invitation_status DEFAULT 'pending',
  message TEXT, -- Optional personal message
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_profile_id UUID REFERENCES profiles(id),
  revoked_by UUID REFERENCES profiles(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate pending invitations
  UNIQUE(email, organization_id, status) WHERE status = 'pending'
);
```

---

### audit_logs

Security and compliance audit trail.

```sql
CREATE TYPE audit_action AS ENUM (
  -- Auth actions
  'sign_in',
  'sign_out',
  'password_reset',
  'mfa_enabled',
  'mfa_disabled',
  
  -- User management
  'user_invited',
  'user_activated',
  'user_suspended',
  'user_revoked',
  'role_changed',
  'scope_changed',
  
  -- Organization actions
  'org_created',
  'org_updated',
  'dept_created',
  'dept_updated',
  
  -- Data access
  'data_exported',
  'report_generated',
  
  -- Operational actions
  'alert_acknowledged',
  'alert_resolved',
  'inspection_completed',
  'approval_granted',
  'approval_denied'
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id), -- NULL for system actions
  action audit_action NOT NULL,
  target_type VARCHAR(50), -- 'user', 'organization', 'farm', etc.
  target_id UUID,
  organization_id UUID REFERENCES organizations(id),
  metadata JSONB DEFAULT '{}', -- Action-specific details
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
```

---

### access_policies

Organization-level access configuration.

```sql
CREATE TABLE access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
  require_mfa BOOLEAN DEFAULT FALSE,
  allowed_ip_ranges JSONB, -- CIDR ranges
  session_timeout_minutes INT DEFAULT 60,
  max_concurrent_sessions INT DEFAULT 5,
  password_min_length INT DEFAULT 12,
  password_require_complexity BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### mfa_policies

MFA configuration per role/organization.

```sql
CREATE TABLE mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  role_template_id UUID REFERENCES role_templates(id),
  require_mfa BOOLEAN DEFAULT FALSE,
  allowed_methods JSONB DEFAULT '["totp"]', -- 'totp', 'sms'
  enrollment_grace_days INT DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Either org-wide or role-specific
  CONSTRAINT mfa_scope CHECK (
    organization_id IS NOT NULL OR role_template_id IS NOT NULL
  )
);
```

---

## RLS Strategy Summary

All tables with tenant/operational data will have RLS enabled:

| Table | RLS Policy |
|-------|------------|
| profiles | Users can read/update own profile |
| memberships | Users can read own memberships; admins can manage |
| organizations | Users can read orgs they're members of |
| departments | Users can read depts in their orgs |
| invitations | Admins can manage; invitees can read own |
| audit_logs | Admins can read org logs; users see own actions |

Detailed RLS policies defined in Step 1.6.

---

## Migration Order

```
1. 00001_extensions.sql (uuid-ossp, pgcrypto)
2. 00002_enums.sql (organization_type, membership_status, etc.)
3. 00003_country_instances.sql
4. 00004_branding_legal.sql
5. 00005_organizations.sql
6. 00006_departments.sql
7. 00007_regions.sql
8. 00008_profiles.sql
9. 00009_role_templates.sql
10. 00010_permission_templates.sql
11. 00011_memberships.sql
12. 00012_invitations.sql
13. 00013_audit_logs.sql
14. 00014_access_policies.sql
15. 00015_rls_policies.sql
```
