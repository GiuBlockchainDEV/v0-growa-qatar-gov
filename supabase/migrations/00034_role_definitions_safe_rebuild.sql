-- Safe rebuild of public.role_definitions when legacy schema lacks role_key.
-- Uses a single DO block so INSERT is planned only after columns exist.

DO $$
DECLARE
  has_role_key BOOLEAN;
  relkind CHAR;
BEGIN
  SELECT c.relkind
  INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'role_definitions';

  IF relkind = 'v' THEN
    EXECUTE 'ALTER VIEW public.role_definitions RENAME TO role_definitions_legacy_archive';
    relkind := NULL;
  END IF;

  IF relkind = 'r' THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'role_definitions'
        AND column_name = 'role_key'
    ) INTO has_role_key;

    IF NOT has_role_key THEN
      EXECUTE 'ALTER TABLE public.role_definitions RENAME TO role_definitions_legacy_archive';
      relkind := NULL;
    END IF;
  END IF;

  IF to_regclass('public.role_definitions') IS NULL THEN
    CREATE TABLE public.role_definitions (
      role_key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      description TEXT,
      domain TEXT,
      is_org_admin BOOLEAN NOT NULL DEFAULT FALSE,
      is_approver BOOLEAN NOT NULL DEFAULT FALSE,
      legacy_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;

  INSERT INTO public.role_definitions (role_key, display_name, domain, is_org_admin, is_approver, legacy_aliases)
  SELECT v.role_key, v.display_name, v.domain, v.is_org_admin, v.is_approver, v.legacy_aliases
  FROM (
    VALUES
      ('owner', 'Owner', 'organization', TRUE, FALSE, '["owner"]'::jsonb),
      ('admin', 'Administrator', 'organization', TRUE, FALSE, '["admin"]'::jsonb),
      ('ministry_admin', 'Ministry administrator', 'government', TRUE, TRUE, '["ministry_admin","ministry_super_admin"]'::jsonb),
      ('ministry_officer', 'Ministry officer', 'government', FALSE, FALSE, '["ministry_officer"]'::jsonb),
      ('ministry_inspector', 'Inspector', 'government', FALSE, FALSE, '["ministry_inspector","inspector"]'::jsonb),
      ('sourcing_manager', 'Supply manager', 'supply', FALSE, FALSE, '["sourcing_manager","supply_chain_officer","hassad_admin"]'::jsonb),
      ('finance_officer', 'Finance officer', 'finance', FALSE, FALSE, '["finance_officer","credit_analyst","qdb_admin"]'::jsonb),
      ('farm_company_admin', 'Farm company administrator', 'farm', TRUE, FALSE, '["farm_company_admin"]'::jsonb),
      ('farm_manager', 'Farm manager', 'farm', FALSE, FALSE, '["farm_manager"]'::jsonb),
      ('agronomist', 'Agronomist', 'farm', FALSE, FALSE, '["agronomist"]'::jsonb),
      ('analyst', 'Analyst', 'intelligence', FALSE, FALSE, '["analyst"]'::jsonb),
      ('operator', 'Operator', 'operations', FALSE, FALSE, '["operator","editor"]'::jsonb),
      ('viewer', 'Viewer', 'organization', FALSE, FALSE, '["viewer","member"]'::jsonb)
  ) AS v(role_key, display_name, domain, is_org_admin, is_approver, legacy_aliases)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.role_definitions rd WHERE rd.role_key = v.role_key
  );
END
$$;

ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_definitions_read ON public.role_definitions;
CREATE POLICY role_definitions_read
  ON public.role_definitions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
