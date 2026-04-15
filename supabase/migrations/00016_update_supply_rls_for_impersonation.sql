-- Expand supply overview read policies to support both membership models
-- and impersonation context (`get_effective_role`) when available.

DROP POLICY IF EXISTS "supply_snapshots_select_members" ON public.supply_overview_snapshots;
DROP POLICY IF EXISTS "supply_flows_select_members" ON public.supply_flows;
DROP POLICY IF EXISTS "supply_action_queue_select_members" ON public.supply_action_queue;

DO $$
DECLARE
  has_effective_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_effective_role'
  )
  INTO has_effective_role;

  IF has_effective_role THEN
    CREATE POLICY "supply_snapshots_select_members"
      ON public.supply_overview_snapshots
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_overview_snapshots.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.memberships ms
          WHERE ms.profile_id = auth.uid()
            AND ms.organization_id = supply_overview_snapshots.organization_id
            AND ms.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.get_effective_role() er
          WHERE COALESCE(er.is_impersonating, FALSE) = TRUE
            AND er.org_id = supply_overview_snapshots.organization_id
        )
      );

    CREATE POLICY "supply_flows_select_members"
      ON public.supply_flows
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_flows.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.memberships ms
          WHERE ms.profile_id = auth.uid()
            AND ms.organization_id = supply_flows.organization_id
            AND ms.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.get_effective_role() er
          WHERE COALESCE(er.is_impersonating, FALSE) = TRUE
            AND er.org_id = supply_flows.organization_id
        )
      );

    CREATE POLICY "supply_action_queue_select_members"
      ON public.supply_action_queue
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_action_queue.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.memberships ms
          WHERE ms.profile_id = auth.uid()
            AND ms.organization_id = supply_action_queue.organization_id
            AND ms.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.get_effective_role() er
          WHERE COALESCE(er.is_impersonating, FALSE) = TRUE
            AND er.org_id = supply_action_queue.organization_id
        )
      );
  ELSE
    CREATE POLICY "supply_snapshots_select_members"
      ON public.supply_overview_snapshots
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_overview_snapshots.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.memberships ms
          WHERE ms.profile_id = auth.uid()
            AND ms.organization_id = supply_overview_snapshots.organization_id
            AND ms.status = 'active'
        )
      );

    CREATE POLICY "supply_flows_select_members"
      ON public.supply_flows
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_flows.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.memberships ms
          WHERE ms.profile_id = auth.uid()
            AND ms.organization_id = supply_flows.organization_id
            AND ms.status = 'active'
        )
      );

    CREATE POLICY "supply_action_queue_select_members"
      ON public.supply_action_queue
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_action_queue.organization_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.memberships ms
          WHERE ms.profile_id = auth.uid()
            AND ms.organization_id = supply_action_queue.organization_id
            AND ms.status = 'active'
        )
      );
  END IF;
END
$$;
