-- Expand supply overview read policies to support both membership models
-- and impersonation context (`get_effective_role`) when available.

DROP POLICY IF EXISTS "supply_snapshots_select_members" ON public.supply_overview_snapshots;
DROP POLICY IF EXISTS "supply_flows_select_members" ON public.supply_flows;
DROP POLICY IF EXISTS "supply_action_queue_select_members" ON public.supply_action_queue;

DO $$
DECLARE
  has_effective_role BOOLEAN;
  has_memberships BOOLEAN;
  has_user_org_members BOOLEAN;
  condition_sql TEXT;
  table_name TEXT;
  policy_name TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_effective_role'
  )
  INTO has_effective_role;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'memberships'
      AND c.relkind IN ('r', 'p')
  )
  INTO has_memberships;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_organization_members'
      AND c.relkind IN ('r', 'p')
  )
  INTO has_user_org_members;

  FOR table_name, policy_name IN
    SELECT 'supply_overview_snapshots', 'supply_snapshots_select_members'
    UNION ALL
    SELECT 'supply_flows', 'supply_flows_select_members'
    UNION ALL
    SELECT 'supply_action_queue', 'supply_action_queue_select_members'
  LOOP
    condition_sql := '';

    IF has_user_org_members THEN
      condition_sql := condition_sql || format(
        'EXISTS (SELECT 1 FROM public.user_organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = %I.organization_id)',
        table_name
      );
    END IF;

    IF has_memberships THEN
      IF condition_sql <> '' THEN
        condition_sql := condition_sql || ' OR ';
      END IF;
      condition_sql := condition_sql || format(
        'EXISTS (SELECT 1 FROM public.memberships ms WHERE ms.profile_id = auth.uid() AND ms.organization_id = %I.organization_id AND ms.status = ''active'')',
        table_name
      );
    END IF;

    IF has_effective_role THEN
      IF condition_sql <> '' THEN
        condition_sql := condition_sql || ' OR ';
      END IF;
      condition_sql := condition_sql || format(
        'EXISTS (SELECT 1 FROM public.get_effective_role() er WHERE COALESCE(er.is_impersonating, FALSE) = TRUE AND er.org_id = %I.organization_id)',
        table_name
      );
    END IF;

    IF condition_sql = '' THEN
      -- No membership source available; deny by default.
      condition_sql := 'FALSE';
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (%s)',
      policy_name,
      table_name,
      condition_sql
    );
  END LOOP;
END
$$;
