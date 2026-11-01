-- NFII User Management — Phase 1 security and authorization hardening
-- REVISION NFII_00031_R2: does NOT define get_my_auth_capabilities (see 00032 / 00035).
-- If 00032 already OK and 00031 fails with 42P13 on that function, you are on an OLD script:
-- run 00036_phase1_completion_skip_auth_caps.sql instead of re-running 00031.
-- Idempotent where practical. Does not drop user data.

-- -----------------------------------------------------------------------------
-- Platform administrators (explicit UUID allowlist; not email domain)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Deactivate stale preview rows for users who are not platform administrators.
UPDATE public.user_impersonation_state s
SET is_impersonating = FALSE, role_name = NULL, org_id = NULL, updated_at = NOW()
WHERE COALESCE(s.is_impersonating, FALSE) = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = s.user_id
  );

DROP POLICY IF EXISTS platform_admins_deny_direct ON public.platform_admins;
CREATE POLICY platform_admins_deny_direct
  ON public.platform_admins
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.platform_admins pa
      WHERE pa.user_id = p_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;

-- One-time bootstrap: run with service role / postgres only (no end-user JWT).
CREATE OR REPLACE FUNCTION public.bootstrap_first_platform_admin(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'bootstrap_first_platform_admin must be invoked without a user JWT (service role or SQL editor only)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.platform_admins) THEN
    RAISE EXCEPTION 'Platform administrator already bootstrapped';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Unknown auth.users id: %', p_user_id;
  END IF;

  INSERT INTO public.platform_admins (user_id, notes)
  VALUES (p_user_id, 'bootstrap_first_platform_admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_platform_admin(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_platform_admin(v_actor) THEN
    RAISE EXCEPTION 'Only platform administrators can grant platform admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Unknown auth.users id: %', p_user_id;
  END IF;

  INSERT INTO public.platform_admins (user_id, granted_by, notes)
  VALUES (p_user_id, v_actor, 'grant_platform_admin')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_platform_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_platform_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_platform_admin(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_platform_admin(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Role rank helpers (membership authorization)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.membership_role_rank(p_role TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p_role, '')))
    WHEN 'owner' THEN 1000
    WHEN 'super_admin' THEN 900
    WHEN 'ministry_super_admin' THEN 850
    WHEN 'ministry_admin' THEN 800
    WHEN 'hassad_admin' THEN 750
    WHEN 'qdb_admin' THEN 750
    WHEN 'farm_company_admin' THEN 700
    WHEN 'admin' THEN 600
    WHEN 'ministry_officer' THEN 500
    WHEN 'sourcing_manager' THEN 450
    WHEN 'supply_chain_officer' THEN 450
    WHEN 'finance_officer' THEN 450
    WHEN 'credit_analyst' THEN 450
    WHEN 'farm_manager' THEN 400
    WHEN 'agronomist' THEN 400
    WHEN 'technical_support' THEN 350
    WHEN 'editor' THEN 250
    WHEN 'operator' THEN 250
    WHEN 'member' THEN 100
    WHEN 'viewer' THEN 50
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p_role, ''))) IN ('owner', 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.count_org_owners(p_org_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.user_organization_members m
  WHERE m.organization_id = p_org_id
    AND COALESCE(m.status, 'active') <> 'inactive'
    AND public.is_org_owner_role(m.role);
$$;

REVOKE ALL ON FUNCTION public.count_org_owners(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_org_owners(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Membership context (never applies role preview / impersonation)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_membership_role_context();
DROP FUNCTION IF EXISTS public.get_effective_role();

CREATE OR REPLACE FUNCTION public.get_membership_role_context()
RETURNS TABLE (
  role_name TEXT,
  org_id UUID,
  org_name TEXT,
  org_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_base RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT
    m.role,
    m.organization_id,
    o.name,
    COALESCE(o.organization_type, o.type, 'private') AS org_type_value
  INTO v_base
  FROM public.user_organization_members m
  LEFT JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = v_uid
    AND COALESCE(m.status, 'active') <> 'inactive'
  ORDER BY
    public.membership_role_rank(m.role) DESC,
    m.created_at ASC
  LIMIT 1;

  IF v_base.organization_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      COALESCE(v_base.role, 'viewer')::TEXT,
      v_base.organization_id::UUID,
      COALESCE(v_base.name, '')::TEXT,
      COALESCE(v_base.org_type_value, 'private')::TEXT;
  END IF;
END;
$$;

-- UI/navigation preview only — does not grant RLS access.
CREATE OR REPLACE FUNCTION public.get_effective_role()
RETURNS TABLE (
  role_name TEXT,
  org_id UUID,
  org_name TEXT,
  org_type TEXT,
  is_impersonating BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_preview RECORD;
  v_membership RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT s.role_name, s.org_id, s.is_impersonating
  INTO v_preview
  FROM public.user_impersonation_state s
  WHERE s.user_id = v_uid
  LIMIT 1;

  IF COALESCE(v_preview.is_impersonating, FALSE) = TRUE
     AND v_preview.org_id IS NOT NULL
     AND public.is_platform_admin(v_uid) THEN
    RETURN QUERY
    SELECT
      COALESCE(v_preview.role_name, 'viewer')::TEXT,
      o.id,
      o.name::TEXT,
      COALESCE(o.organization_type, o.type, 'private')::TEXT,
      TRUE
    FROM public.organizations o
    WHERE o.id = v_preview.org_id;
    RETURN;
  END IF;

  SELECT * INTO v_membership
  FROM public.get_membership_role_context() mc
  LIMIT 1;

  IF v_membership.org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_membership.role_name,
      v_membership.org_id,
      v_membership.org_name,
      v_membership.org_type,
      FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, FALSE;
END;
$$;

-- get_my_auth_capabilities: defined in 00032 / 00035 (5 columns incl. platform_staff_tier).
-- Do not CREATE here — avoids 42P13 when 00035 or 00032 was applied first.

REVOKE ALL ON FUNCTION public.get_membership_role_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_effective_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_membership_role_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_role() TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.get_my_auth_capabilities()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_my_auth_capabilities() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_my_auth_capabilities() TO authenticated;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Role preview (formerly impersonation) — platform admins only; UI context
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_impersonation(p_role TEXT, p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_platform_admin(v_uid) THEN
    RAISE EXCEPTION 'Only platform administrators can activate role preview';
  END IF;

  IF p_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org_id) THEN
    RAISE EXCEPTION 'Invalid preview organization';
  END IF;

  INSERT INTO public.user_impersonation_state (user_id, role_name, org_id, is_impersonating, updated_at)
  VALUES (v_uid, NULLIF(trim(p_role), ''), p_org_id, TRUE, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role_name = EXCLUDED.role_name,
    org_id = EXCLUDED.org_id,
    is_impersonating = TRUE,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_impersonation()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_impersonation_state
  SET role_name = NULL, org_id = NULL, is_impersonating = FALSE, updated_at = NOW()
  WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_impersonation(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_impersonation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_impersonation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_impersonation() TO authenticated;

DROP POLICY IF EXISTS impersonation_state_own ON public.user_impersonation_state;
DROP POLICY IF EXISTS impersonation_state_select_own ON public.user_impersonation_state;
CREATE POLICY impersonation_state_select_own
  ON public.user_impersonation_state
  FOR SELECT
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Organization creation — restrict privileged org types
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  org_description TEXT DEFAULT NULL,
  org_type TEXT DEFAULT 'private'
)
RETURNS TABLE (organization_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_slug TEXT;
  v_name TEXT;
  v_type TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := trim(coalesce(org_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  v_slug := lower(trim(coalesce(org_slug, '')));
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Organization slug is required';
  END IF;

  v_type := lower(trim(coalesce(org_type, 'private')));
  IF v_type NOT IN ('government_master', 'government', 'farm_company', 'public', 'private') THEN
    RAISE EXCEPTION 'Invalid organization type';
  END IF;

  IF v_type IN ('government_master', 'government') AND NOT public.is_platform_admin(v_user_id) THEN
    RAISE EXCEPTION 'Only platform administrators can create government organizations';
  END IF;

  INSERT INTO public.organizations (
    name,
    slug,
    description,
    organization_type,
    type
  )
  VALUES (
    v_name,
    v_slug,
    NULLIF(trim(coalesce(org_description, '')), ''),
    v_type,
    v_type
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.user_organization_members (
    user_id,
    organization_id,
    role,
    status
  )
  VALUES (
    v_user_id,
    v_org_id,
    'owner',
    'active'
  )
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET role = 'owner', status = 'active';

  RETURN QUERY SELECT v_org_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Organization slug already exists';
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- Membership mutation guard (self-promotion, escalation, last owner)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_organization_members_authorization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_rank INT;
  v_target_rank INT;
  v_proposed_rank INT;
  v_old_rank INT;
  v_owners INT;
  v_is_platform BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_platform := public.is_platform_admin(v_actor);
  IF v_is_platform THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT m.role
  INTO v_actor_role
  FROM public.user_organization_members m
  WHERE m.user_id = v_actor
    AND m.organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
    AND COALESCE(m.status, 'active') <> 'inactive'
  ORDER BY public.membership_role_rank(m.role) DESC
  LIMIT 1;

  v_actor_rank := public.membership_role_rank(v_actor_role);
  IF v_actor_rank < public.membership_role_rank('admin') THEN
    RAISE EXCEPTION 'Insufficient privileges to modify organization membership';
  END IF;

  v_owners := public.count_org_owners(COALESCE(NEW.organization_id, OLD.organization_id));

  IF TG_OP = 'INSERT' THEN
    -- First owner row for a newly created organization (self-service org RPC).
    IF NEW.user_id = v_actor
       AND public.is_org_owner_role(NEW.role)
       AND NOT EXISTS (
         SELECT 1
         FROM public.user_organization_members m
         WHERE m.organization_id = NEW.organization_id
       ) THEN
      RETURN NEW;
    END IF;

    v_proposed_rank := public.membership_role_rank(NEW.role);
    IF v_proposed_rank > v_actor_rank THEN
      RAISE EXCEPTION 'Cannot assign a role above your authority';
    END IF;
    IF public.is_org_owner_role(NEW.role) AND NOT public.is_org_owner_role(v_actor_role) THEN
      RAISE EXCEPTION 'Only organization owners can assign owner-level roles';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_proposed_rank := public.membership_role_rank(NEW.role);
    v_old_rank := public.membership_role_rank(OLD.role);

    IF NEW.user_id = v_actor AND v_proposed_rank > v_old_rank THEN
      RAISE EXCEPTION 'Self-promotion is not allowed';
    END IF;

    IF v_proposed_rank > v_actor_rank THEN
      RAISE EXCEPTION 'Cannot assign a role above your authority';
    END IF;

    IF public.is_org_owner_role(NEW.role) AND NOT public.is_org_owner_role(v_actor_role) THEN
      RAISE EXCEPTION 'Only organization owners can assign owner-level roles';
    END IF;

    IF public.is_org_owner_role(OLD.role) AND v_proposed_rank < v_old_rank AND v_owners <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last organization owner';
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_target_rank := public.membership_role_rank(OLD.role);
    IF public.is_org_owner_role(OLD.role) AND v_owners <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last organization owner';
    END IF;
    IF v_target_rank > v_actor_rank THEN
      RAISE EXCEPTION 'Cannot remove a member with higher authority than yours';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_org_members_auth ON public.user_organization_members;
CREATE TRIGGER trg_enforce_user_org_members_auth
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_organization_members_authorization();

-- -----------------------------------------------------------------------------
-- Governance RPCs — authorization uses real membership, not role preview
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_visibility(
  p_user_id UUID,
  p_shared_layer TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_role TEXT;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN 'NO';
  END IF;

  SELECT mc.role_name INTO v_effective_role
  FROM public.get_membership_role_context() mc
  LIMIT 1;

  IF v_effective_role IS NULL THEN
    RETURN 'NO';
  END IF;

  IF v_effective_role IN ('super_admin', 'ministry_admin', 'ministry_super_admin') THEN
    RETURN 'FULL';
  END IF;

  IF p_shared_layer = 'regulatory' THEN
    IF v_effective_role IN ('ministry_officer') THEN RETURN 'SUMMARY'; END IF;
    RETURN 'NO';
  ELSIF p_shared_layer = 'commercial' THEN
    IF v_effective_role IN (
      'sourcing_manager', 'supply_chain_officer', 'hassad_admin',
      'farm_manager', 'agronomist', 'farm_company_admin', 'operator'
    ) THEN RETURN 'FULL'; END IF;
    RETURN 'NO';
  ELSIF p_shared_layer = 'finance' THEN
    IF v_effective_role IN ('finance_officer', 'credit_analyst', 'qdb_admin') THEN RETURN 'FULL'; END IF;
    RETURN 'NO';
  ELSIF p_shared_layer = 'technical_support' THEN
    IF v_effective_role IN ('technical_support', 'farm_manager', 'agronomist', 'farm_company_admin') THEN RETURN 'SUMMARY'; END IF;
    RETURN 'NO';
  END IF;

  RETURN 'NO';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_user_access(
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_access BOOLEAN := FALSE;
  has_memberships BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN FALSE;
  END IF;

  IF p_resource_org_id IS NULL THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_members m
    WHERE m.user_id = p_user_id
      AND m.organization_id = p_resource_org_id
      AND COALESCE(m.status, 'inactive') <> 'inactive'
  )
  INTO v_can_access;

  IF v_can_access THEN
    RETURN TRUE;
  END IF;

  has_memberships := to_regclass('public.memberships') IS NOT NULL;
  IF has_memberships THEN
    EXECUTE $q$
      SELECT EXISTS (
        SELECT 1
        FROM public.memberships ms
        WHERE ms.profile_id = $1
          AND ms.organization_id = $2
          AND ms.status = 'active'
      )
    $q$
    INTO v_can_access
    USING p_user_id, p_resource_org_id;

    IF v_can_access THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- -----------------------------------------------------------------------------
-- Supply overview RLS — remove role-preview bypass
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "supply_snapshots_select_members" ON public.supply_overview_snapshots;
DROP POLICY IF EXISTS "supply_flows_select_members" ON public.supply_flows;
DROP POLICY IF EXISTS "supply_action_queue_select_members" ON public.supply_action_queue;

DO $$
DECLARE
  has_memberships BOOLEAN;
  has_user_org_members BOOLEAN;
  condition_sql TEXT;
  table_name TEXT;
  policy_name TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'memberships' AND c.relkind IN ('r', 'p')
  ) INTO has_memberships;

  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_organization_members' AND c.relkind IN ('r', 'p')
  ) INTO has_user_org_members;

  FOR table_name, policy_name IN
    SELECT 'supply_overview_snapshots', 'supply_snapshots_select_members'
    UNION ALL SELECT 'supply_flows', 'supply_flows_select_members'
    UNION ALL SELECT 'supply_action_queue', 'supply_action_queue_select_members'
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    condition_sql := '';
    IF has_user_org_members THEN
      condition_sql := condition_sql || format(
        'EXISTS (SELECT 1 FROM public.user_organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = %I.organization_id AND COALESCE(m.status, ''active'') <> ''inactive'')',
        table_name
      );
    END IF;

    IF has_memberships THEN
      IF condition_sql <> '' THEN condition_sql := condition_sql || ' OR '; END IF;
      condition_sql := condition_sql || format(
        'EXISTS (SELECT 1 FROM public.memberships ms WHERE ms.profile_id = auth.uid() AND ms.organization_id = %I.organization_id AND ms.status = ''active'')',
        table_name
      );
    END IF;

    IF condition_sql = '' THEN
      condition_sql := 'FALSE';
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (%s)',
      policy_name, table_name, condition_sql
    );
  END LOOP;
END
$$;
