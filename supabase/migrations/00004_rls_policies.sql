-- Growa Qatar - Row Level Security Policies
-- Step 1.8: Enable RLS and create policies

-- ============================================
-- RLS Helper Functions
-- ============================================

-- Get current user ID
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid()
$$;

-- Get user's organization IDs
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(ARRAY_AGG(organization_id), ARRAY[]::UUID[])
  FROM memberships
  WHERE profile_id = auth.uid()
    AND status = 'active'
$$;

-- Check if user is member of organization
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

-- Check if user is admin of organization
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

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE country_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_label_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_policies ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Reference Data Policies (read by authenticated users)
-- ============================================

-- Country instances
CREATE POLICY "Authenticated users can read active country instances"
ON country_instances FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Legal label sets
CREATE POLICY "Authenticated users can read legal labels"
ON legal_label_sets FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Regions
CREATE POLICY "Authenticated users can read regions"
ON regions FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Role templates
CREATE POLICY "Authenticated users can read role templates"
ON role_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Permission templates
CREATE POLICY "Authenticated users can read permission templates"
ON permission_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ============================================
-- Organization Policies
-- ============================================

-- Organizations: members can read
CREATE POLICY "Members can read their organizations"
ON organizations FOR SELECT
USING (is_org_member(id) OR is_active = FALSE);

-- Branding: members can read org branding, all can read country branding
CREATE POLICY "Users can read branding configs"
ON branding_configs FOR SELECT
USING (
  (country_instance_id IS NOT NULL) OR
  (organization_id IS NOT NULL AND is_org_member(organization_id))
);

-- Departments: members can read
CREATE POLICY "Members can read org departments"
ON departments FOR SELECT
USING (is_org_member(organization_id));

-- ============================================
-- Profile Policies
-- ============================================

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
    SELECT 1 FROM memberships m
    WHERE m.profile_id = profiles.id
      AND is_org_admin(m.organization_id)
  )
);

-- ============================================
-- Membership Policies
-- ============================================

-- Users can read their own memberships
CREATE POLICY "Users can read own memberships"
ON memberships FOR SELECT
USING (profile_id = auth.uid());

-- Admins can read org memberships
CREATE POLICY "Admins can read org memberships"
ON memberships FOR SELECT
USING (is_org_admin(organization_id));

-- ============================================
-- Invitation Policies
-- ============================================

-- Admins can read org invitations
CREATE POLICY "Admins can read org invitations"
ON invitations FOR SELECT
USING (is_org_admin(organization_id));

-- ============================================
-- Audit Log Policies
-- ============================================

-- Users can read their own audit entries
CREATE POLICY "Users can read own audit logs"
ON audit_logs FOR SELECT
USING (actor_id = auth.uid());

-- Admins can read org audit logs
CREATE POLICY "Admins can read org audit logs"
ON audit_logs FOR SELECT
USING (is_org_admin(organization_id));

-- ============================================
-- Access/MFA Policy Policies
-- ============================================

-- Members can read their org's access policies
CREATE POLICY "Members can read org access policies"
ON access_policies FOR SELECT
USING (is_org_member(organization_id));

-- Members can read relevant MFA policies
CREATE POLICY "Members can read MFA policies"
ON mfa_policies FOR SELECT
USING (
  (organization_id IS NOT NULL AND is_org_member(organization_id)) OR
  (role_template_id IS NOT NULL)
);
