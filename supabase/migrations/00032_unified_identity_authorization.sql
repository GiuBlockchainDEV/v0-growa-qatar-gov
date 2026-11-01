-- Phase 2: unified identity, organization, and permission model (compatibility layer).

-- Platform staff tiers (requires 00031 platform_admins).
DO $$
BEGIN
  IF to_regclass('public.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'Run 00031_user_management_security_hardening.sql before 00032';
  END IF;

  ALTER TABLE public.platform_admins
    ADD COLUMN IF NOT EXISTS staff_tier TEXT NOT NULL DEFAULT 'super_admin';

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_admins_staff_tier_check'
      AND conrelid = 'public.platform_admins'::regclass
  ) THEN
    ALTER TABLE public.platform_admins
      ADD CONSTRAINT platform_admins_staff_tier_check
      CHECK (staff_tier IN ('super_admin', 'support'));
  END IF;
END
$$;

-- Canonical role registry — see 00034_role_definitions_safe_rebuild.sql (runs in same migration batch).

-- Map legacy role_templates.code → canonical role (conservative; never escalates).
CREATE OR REPLACE FUNCTION public.map_legacy_role_template_to_canonical(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p_code, '')))
    WHEN 'super_admin' THEN 'super_admin'
    WHEN 'admin' THEN 'admin'
    WHEN 'ministry_super_admin' THEN 'ministry_admin'
    WHEN 'ministry_admin' THEN 'ministry_admin'
    WHEN 'ministry_officer' THEN 'ministry_officer'
    WHEN 'inspector' THEN 'ministry_inspector'
    WHEN 'hassad_admin' THEN 'sourcing_manager'
    WHEN 'supply_chain_officer' THEN 'sourcing_manager'
    WHEN 'sourcing_manager' THEN 'sourcing_manager'
    WHEN 'finance_officer' THEN 'finance_officer'
    WHEN 'credit_analyst' THEN 'finance_officer'
    WHEN 'qdb_admin' THEN 'finance_officer'
    WHEN 'farm_company_admin' THEN 'farm_company_admin'
    WHEN 'farm_manager' THEN 'farm_manager'
    WHEN 'agronomist' THEN 'agronomist'
    WHEN 'operator' THEN 'operator'
    WHEN 'editor' THEN 'operator'
    WHEN 'viewer' THEN 'viewer'
    WHEN 'member' THEN 'viewer'
    WHEN 'owner' THEN 'owner'
    ELSE 'viewer'
  END;
$$;

DROP FUNCTION IF EXISTS public.list_legacy_memberships_for_user(UUID);

CREATE OR REPLACE FUNCTION public.list_legacy_memberships_for_user(p_user_id UUID)
RETURNS TABLE (organization_id UUID, role TEXT, status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN;
  END IF;

  IF to_regclass('public.memberships') IS NULL OR to_regclass('public.role_templates') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.organization_id,
    public.map_legacy_role_template_to_canonical(rt.code)::TEXT AS role,
    CASE WHEN m.status::TEXT = 'active' THEN 'active' ELSE 'inactive' END AS status
  FROM public.memberships m
  JOIN public.role_templates rt ON rt.id = m.role_template_id
  WHERE m.profile_id = p_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_organization_members uom
      WHERE uom.user_id = p_user_id
        AND uom.organization_id = m.organization_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.list_legacy_memberships_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_legacy_memberships_for_user(UUID) TO authenticated;

-- Idempotent backfill: copy legacy memberships into canonical table without overwriting.
DO $$
BEGIN
  IF to_regclass('public.memberships') IS NOT NULL AND to_regclass('public.role_templates') IS NOT NULL THEN
    INSERT INTO public.user_organization_members (user_id, organization_id, role, status)
    SELECT
      m.profile_id,
      m.organization_id,
      public.map_legacy_role_template_to_canonical(rt.code),
      CASE WHEN m.status::TEXT = 'active' THEN 'active' ELSE 'inactive' END
    FROM public.memberships m
    JOIN public.role_templates rt ON rt.id = m.role_template_id
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  END IF;
END
$$;

-- Auth capabilities RPC (5 columns). DROP required when upgrading from 00031 four-column version.
-- Same body as 00035_fix_get_my_auth_capabilities_signature.sql (safe to re-run 00035 after this).
DROP FUNCTION IF EXISTS public.get_my_auth_capabilities();

CREATE OR REPLACE FUNCTION public.get_my_auth_capabilities()
RETURNS TABLE (
  is_platform_admin BOOLEAN,
  platform_staff_tier TEXT,
  role_preview_active BOOLEAN,
  preview_role TEXT,
  preview_org_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_preview RECORD;
  v_tier TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT s.role_name, s.org_id, s.is_impersonating
  INTO v_preview
  FROM public.user_impersonation_state s
  WHERE s.user_id = v_uid
  LIMIT 1;

  SELECT pa.staff_tier INTO v_tier
  FROM public.platform_admins pa
  WHERE pa.user_id = v_uid
  LIMIT 1;

  RETURN QUERY
  SELECT
    public.is_platform_admin(v_uid),
    COALESCE(v_tier, CASE WHEN public.is_platform_admin(v_uid) THEN 'super_admin' ELSE NULL END),
    COALESCE(v_preview.is_impersonating, FALSE) AND public.is_platform_admin(v_uid),
    CASE WHEN COALESCE(v_preview.is_impersonating, FALSE) THEN v_preview.role_name ELSE NULL END,
    CASE WHEN COALESCE(v_preview.is_impersonating, FALSE) THEN v_preview.org_id ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_auth_capabilities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_auth_capabilities() TO authenticated;

-- Organization type consolidation helper (read path prefers organization_type).
CREATE OR REPLACE FUNCTION public.organization_type_value(p_org public.organizations)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(p_org.organization_type), ''), NULLIF(trim(p_org.type), ''), 'private');
$$;
