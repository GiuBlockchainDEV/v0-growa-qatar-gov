-- Unified application core schema for roles, functions, and cross-module compatibility.
-- This migration is intentionally defensive/idempotent to support mixed legacy states.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Organizations (compatibility across legacy/new columns)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS organization_type TEXT,
  ADD COLUMN IF NOT EXISTS tier INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.organizations
SET
  name = COALESCE(NULLIF(TRIM(name), ''), 'Organization'),
  slug = COALESCE(NULLIF(TRIM(slug), ''), 'org-' || SUBSTRING(id::text, 1, 8)),
  type = COALESCE(NULLIF(TRIM(type), ''), NULLIF(TRIM(organization_type), ''), 'private'),
  organization_type = COALESCE(NULLIF(TRIM(organization_type), ''), NULLIF(TRIM(type), ''), 'private')
WHERE
  name IS NULL
  OR slug IS NULL
  OR type IS NULL
  OR organization_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND indexname = 'organizations_slug_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX organizations_slug_unique_idx ON public.organizations(slug);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_type_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_type_check
      CHECK (type IN ('government_master', 'government', 'farm_company', 'public', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_organization_type_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_organization_type_check
      CHECK (organization_type IN ('government_master', 'government', 'farm_company', 'public', 'private'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_organization_type_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.type := COALESCE(NULLIF(TRIM(NEW.type), ''), NULLIF(TRIM(NEW.organization_type), ''), 'private');
  NEW.organization_type := COALESCE(NULLIF(TRIM(NEW.organization_type), ''), NULLIF(TRIM(NEW.type), ''), 'private');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_organization_type_columns ON public.organizations;
CREATE TRIGGER trg_sync_organization_type_columns
  BEFORE INSERT OR UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_type_columns();

-- -----------------------------------------------------------------------------
-- Profiles (preferences + identity compatibility)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "inApp": true, "criticalOnly": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS notifications_email BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifications_inapp BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifications_critical_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.profiles
SET
  locale = COALESCE(NULLIF(TRIM(locale), ''), NULLIF(TRIM(preferred_locale), ''), 'en'),
  preferred_locale = COALESCE(NULLIF(TRIM(preferred_locale), ''), NULLIF(TRIM(locale), ''), 'en')
WHERE locale IS NULL OR preferred_locale IS NULL;

-- -----------------------------------------------------------------------------
-- User organization memberships (all app roles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.user_organization_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

DO $$
DECLARE
  c RECORD;
BEGIN
  -- Remove legacy role/status check constraints if present.
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.user_organization_members'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%role%'
        OR pg_get_constraintdef(oid) ILIKE '%status%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.user_organization_members DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.user_organization_members
    ADD CONSTRAINT user_organization_members_role_check
    CHECK (
      role IN (
        'owner', 'admin', 'member',
        'viewer', 'editor', 'operator',
        'super_admin',
        'ministry_officer', 'ministry_admin', 'ministry_super_admin',
        'sourcing_manager', 'supply_chain_officer', 'hassad_admin',
        'finance_officer', 'credit_analyst', 'qdb_admin',
        'farm_manager', 'agronomist', 'farm_company_admin',
        'technical_support'
      )
    );

  ALTER TABLE public.user_organization_members
    ADD CONSTRAINT user_organization_members_status_check
    CHECK (status IN ('active', 'invited', 'inactive'));
END
$$;

CREATE INDEX IF NOT EXISTS user_org_members_user_idx ON public.user_organization_members(user_id);
CREATE INDEX IF NOT EXISTS user_org_members_org_idx ON public.user_organization_members(organization_id);
CREATE INDEX IF NOT EXISTS user_org_members_role_idx ON public.user_organization_members(role);

ALTER TABLE public.user_organization_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_organization_members'
      AND policyname = 'user_org_members_select'
  ) THEN
    CREATE POLICY "user_org_members_select"
      ON public.user_organization_members
      FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = user_organization_members.organization_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_organization_members'
      AND policyname = 'user_org_members_write_admins'
  ) THEN
    CREATE POLICY "user_org_members_write_admins"
      ON public.user_organization_members
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = user_organization_members.organization_id
            AND m.role IN (
              'owner', 'admin', 'super_admin',
              'ministry_admin', 'ministry_super_admin',
              'hassad_admin', 'qdb_admin', 'farm_company_admin'
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = user_organization_members.organization_id
            AND m.role IN (
              'owner', 'admin', 'super_admin',
              'ministry_admin', 'ministry_super_admin',
              'hassad_admin', 'qdb_admin', 'farm_company_admin'
            )
        )
      );
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Role navigation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  landing_page TEXT NOT NULL DEFAULT '/dashboard',
  menu_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.role_navigation ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'role_navigation'
      AND policyname = 'role_navigation_read_authenticated'
  ) THEN
    CREATE POLICY "role_navigation_read_authenticated"
      ON public.role_navigation
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Role delegations (used by governance hook)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegated_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  delegated_role TEXT NOT NULL,
  delegation_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS role_delegations_delegatee_idx
  ON public.role_delegations(delegated_to_user_id, is_active);
CREATE INDEX IF NOT EXISTS role_delegations_org_idx
  ON public.role_delegations(organization_id, is_active);

ALTER TABLE public.role_delegations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'role_delegations'
      AND policyname = 'role_delegations_read_own'
  ) THEN
    CREATE POLICY "role_delegations_read_own"
      ON public.role_delegations
      FOR SELECT
      USING (auth.uid() = user_id OR auth.uid() = delegated_to_user_id);
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Audit logs compatibility
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- -----------------------------------------------------------------------------
-- Impersonation state + role resolution RPCs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_impersonation_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_impersonating BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_impersonation_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_impersonation_state'
      AND policyname = 'impersonation_state_own'
  ) THEN
    CREATE POLICY "impersonation_state_own"
      ON public.user_impersonation_state
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_effective_role()
RETURNS TABLE (
  role_name TEXT,
  org_id UUID,
  org_name TEXT,
  org_type TEXT,
  is_impersonating BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_imp RECORD;
  v_base RECORD;
  v_jwt_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_imp
  FROM public.user_impersonation_state
  WHERE user_id = v_uid
  LIMIT 1;

  IF COALESCE(v_imp.is_impersonating, FALSE) = TRUE AND v_imp.org_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      COALESCE(v_imp.role_name, 'viewer')::TEXT,
      o.id,
      o.name::TEXT,
      COALESCE(o.organization_type, o.type, 'private')::TEXT,
      TRUE;
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
    CASE
      WHEN m.role IN (
        'owner', 'admin', 'super_admin',
        'ministry_admin', 'ministry_super_admin',
        'hassad_admin', 'qdb_admin', 'farm_company_admin'
      ) THEN 0
      ELSE 1
    END,
    m.created_at ASC
  LIMIT 1;

  IF v_base.organization_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      COALESCE(v_base.role, 'viewer')::TEXT,
      v_base.organization_id::UUID,
      COALESCE(v_base.name, '')::TEXT,
      COALESCE(v_base.org_type_value, 'private')::TEXT,
      FALSE;
    RETURN;
  END IF;

  v_jwt_role := NULLIF(COALESCE(auth.jwt() ->> 'role', ''), '');
  RETURN QUERY SELECT COALESCE(v_jwt_role, 'viewer'), NULL::UUID, NULL::TEXT, NULL::TEXT, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_impersonation(p_role TEXT, p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := COALESCE(auth.jwt() ->> 'email', '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF RIGHT(LOWER(v_email), 9) <> '@growa.ai' THEN
    RAISE EXCEPTION 'Only @growa.ai admins can impersonate';
  END IF;

  INSERT INTO public.user_impersonation_state (user_id, role_name, org_id, is_impersonating, updated_at)
  VALUES (v_uid, p_role, p_org_id, TRUE, NOW())
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

  INSERT INTO public.user_impersonation_state (user_id, role_name, org_id, is_impersonating, updated_at)
  VALUES (v_uid, NULL, NULL, FALSE, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role_name = NULL,
    org_id = NULL,
    is_impersonating = FALSE,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_impersonation(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_impersonation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_impersonation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_impersonation() TO authenticated;

-- -----------------------------------------------------------------------------
-- Governance helper RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_visibility(
  p_user_id UUID,
  p_shared_layer TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_role TEXT;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN 'NO';
  END IF;

  SELECT er.role_name INTO v_effective_role
  FROM public.get_effective_role() er
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
      AND COALESCE(m.status, 'active') <> 'inactive'
  )
  INTO v_can_access;

  IF v_can_access THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_effective_role() er
    WHERE COALESCE(er.is_impersonating, FALSE) = TRUE
      AND er.org_id = p_resource_org_id
  ) THEN
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

REVOKE ALL ON FUNCTION public.get_user_visibility(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_user_access(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_visibility(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_access(UUID, TEXT, UUID) TO authenticated;
