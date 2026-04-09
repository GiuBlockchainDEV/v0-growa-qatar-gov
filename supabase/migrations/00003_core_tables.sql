-- Growa Qatar - Core Auth/Access Tables
-- Step 1.8: Create auth/access domain tables

-- Country instances
CREATE TABLE country_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branding configs
CREATE TABLE branding_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id),
  organization_id UUID, -- Will add FK after organizations table
  primary_color VARCHAR(7) NOT NULL,
  secondary_color VARCHAR(7),
  logo_url TEXT,
  favicon_url TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legal label sets
CREATE TABLE legal_label_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id) NOT NULL,
  label_key VARCHAR(100) NOT NULL,
  value_en TEXT NOT NULL,
  value_ar TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_instance_id, label_key)
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id) NOT NULL,
  type organization_type NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK to branding_configs
ALTER TABLE branding_configs 
ADD CONSTRAINT branding_configs_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add check constraint for branding scope
ALTER TABLE branding_configs 
ADD CONSTRAINT branding_scope CHECK (
  (country_instance_id IS NOT NULL AND organization_id IS NULL) OR
  (country_instance_id IS NULL AND organization_id IS NOT NULL)
);

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  parent_department_id UUID REFERENCES departments(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Regions
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_instance_id UUID REFERENCES country_instances(id) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200) NOT NULL,
  parent_region_id UUID REFERENCES regions(id),
  geometry JSONB,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_instance_id, code)
);

-- Profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name_en VARCHAR(200),
  full_name_ar VARCHAR(200),
  phone VARCHAR(20),
  preferred_locale VARCHAR(5) DEFAULT 'en',
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role templates
CREATE TABLE role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  permissions JSONB NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permission templates
CREATE TABLE permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  requires_scope BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, action)
);

-- Memberships
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  department_id UUID REFERENCES departments(id),
  role_template_id UUID REFERENCES role_templates(id) NOT NULL,
  scope_assignments JSONB DEFAULT '{}',
  status membership_status DEFAULT 'pending',
  is_primary BOOLEAN DEFAULT FALSE,
  invited_by UUID REFERENCES profiles(id),
  status_changed_by UUID REFERENCES profiles(id),
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, organization_id)
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  department_id UUID REFERENCES departments(id),
  role_template_id UUID REFERENCES role_templates(id) NOT NULL,
  scope_assignments JSONB DEFAULT '{}',
  invited_by UUID REFERENCES profiles(id) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  status invitation_status DEFAULT 'pending',
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_profile_id UUID REFERENCES profiles(id),
  revoked_by UUID REFERENCES profiles(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  action audit_action NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  organization_id UUID REFERENCES organizations(id),
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access policies
CREATE TABLE access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
  require_mfa BOOLEAN DEFAULT FALSE,
  allowed_ip_ranges JSONB,
  session_timeout_minutes INT DEFAULT 60,
  max_concurrent_sessions INT DEFAULT 5,
  password_min_length INT DEFAULT 12,
  password_require_complexity BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MFA policies
CREATE TABLE mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  role_template_id UUID REFERENCES role_templates(id),
  require_mfa BOOLEAN DEFAULT FALSE,
  allowed_methods JSONB DEFAULT '["totp"]',
  enrollment_grace_days INT DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mfa_scope CHECK (
    organization_id IS NOT NULL OR role_template_id IS NOT NULL
  )
);

-- Indexes for performance
CREATE INDEX idx_memberships_profile ON memberships(profile_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_country_instances_updated_at
  BEFORE UPDATE ON country_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_role_templates_updated_at
  BEFORE UPDATE ON role_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
