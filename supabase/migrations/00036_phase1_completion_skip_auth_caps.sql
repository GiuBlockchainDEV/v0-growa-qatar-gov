-- Run this INSTEAD of re-running 00031 when:
--   • 00032 (or 00035) already succeeded (five-column get_my_auth_capabilities exists), AND
--   • 00031 failed with 42P13 on get_my_auth_capabilities (old 00031 script with 4 columns).
--
-- Applies the remainder of Phase 1 (preview RPCs, org creation, membership trigger, governance, supply RLS).
-- Idempotent. Does not touch get_my_auth_capabilities.

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

DO $$
BEGIN
  IF to_regprocedure('public.get_my_auth_capabilities()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_my_auth_capabilities() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_my_auth_capabilities() TO authenticated;
  END IF;
END
$$;
