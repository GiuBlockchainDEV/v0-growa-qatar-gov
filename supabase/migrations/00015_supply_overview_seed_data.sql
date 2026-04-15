-- Supply overview tables and Hassad Food seed data

CREATE TABLE IF NOT EXISTS public.supply_overview_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  available_contract_volume_tons NUMERIC(12, 2) NOT NULL DEFAULT 0,
  available_contract_volume_delta_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  in_transit_tons NUMERIC(12, 2) NOT NULL DEFAULT 0,
  in_transit_delta_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  at_risk_deliveries_count INT NOT NULL DEFAULT 0,
  at_risk_deliveries_delta_count INT NOT NULL DEFAULT 0,
  avg_lead_time_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
  avg_lead_time_delta_days NUMERIC(8, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (organization_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS public.supply_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flow_code TEXT NOT NULL,
  commodity TEXT NOT NULL,
  origin_label TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('on-track', 'watch', 'risk')),
  eta_label TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supply_snapshots_org_idx
  ON public.supply_overview_snapshots(organization_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS supply_flows_org_priority_idx
  ON public.supply_flows(organization_id, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS supply_action_queue_org_priority_idx
  ON public.supply_action_queue(organization_id, priority, created_at DESC);

ALTER TABLE public.supply_overview_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_action_queue ENABLE ROW LEVEL SECURITY;

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
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supply_overview_snapshots'
      AND policyname = 'supply_snapshots_write_admins'
  ) THEN
    CREATE POLICY "supply_snapshots_write_admins"
      ON public.supply_overview_snapshots
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_overview_snapshots.organization_id
            AND m.role IN ('owner', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_overview_snapshots.organization_id
            AND m.role IN ('owner', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supply_flows'
      AND policyname = 'supply_flows_write_admins'
  ) THEN
    CREATE POLICY "supply_flows_write_admins"
      ON public.supply_flows
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_flows.organization_id
            AND m.role IN ('owner', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_flows.organization_id
            AND m.role IN ('owner', 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supply_action_queue'
      AND policyname = 'supply_action_queue_write_admins'
  ) THEN
    CREATE POLICY "supply_action_queue_write_admins"
      ON public.supply_action_queue
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_action_queue.organization_id
            AND m.role IN ('owner', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = supply_action_queue.organization_id
            AND m.role IN ('owner', 'admin')
        )
      );
  END IF;
END
$$;

DO $$
DECLARE
  v_hassad_org_id UUID;
BEGIN
  INSERT INTO public.organizations (name, slug, description, organization_type)
  VALUES (
    'Hassad Food',
    'hassad-food',
    'Hassad Food sourcing and supply operations',
    'private'
  )
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    organization_type = COALESCE(public.organizations.organization_type, EXCLUDED.organization_type)
  RETURNING id INTO v_hassad_org_id;

  IF v_hassad_org_id IS NULL THEN
    SELECT id INTO v_hassad_org_id
    FROM public.organizations
    WHERE slug = 'hassad-food'
    LIMIT 1;
  END IF;

  IF v_hassad_org_id IS NULL THEN
    RAISE NOTICE 'Hassad organization not found; skipping supply seed.';
    RETURN;
  END IF;

  INSERT INTO public.supply_overview_snapshots (
    organization_id,
    snapshot_date,
    available_contract_volume_tons,
    available_contract_volume_delta_pct,
    in_transit_tons,
    in_transit_delta_pct,
    at_risk_deliveries_count,
    at_risk_deliveries_delta_count,
    avg_lead_time_days,
    avg_lead_time_delta_days
  )
  VALUES (
    v_hassad_org_id,
    CURRENT_DATE,
    12450,
    8.4,
    2140,
    3.1,
    7,
    2,
    4.6,
    -0.4
  )
  ON CONFLICT (organization_id, snapshot_date) DO UPDATE
  SET
    available_contract_volume_tons = EXCLUDED.available_contract_volume_tons,
    available_contract_volume_delta_pct = EXCLUDED.available_contract_volume_delta_pct,
    in_transit_tons = EXCLUDED.in_transit_tons,
    in_transit_delta_pct = EXCLUDED.in_transit_delta_pct,
    at_risk_deliveries_count = EXCLUDED.at_risk_deliveries_count,
    at_risk_deliveries_delta_count = EXCLUDED.at_risk_deliveries_delta_count,
    avg_lead_time_days = EXCLUDED.avg_lead_time_days,
    avg_lead_time_delta_days = EXCLUDED.avg_lead_time_delta_days;

  DELETE FROM public.supply_flows WHERE organization_id = v_hassad_org_id;
  INSERT INTO public.supply_flows (
    organization_id,
    flow_code,
    commodity,
    origin_label,
    destination_label,
    status,
    eta_label,
    priority
  )
  VALUES
    (
      v_hassad_org_id,
      'HF-1021',
      'Fresh Tomatoes',
      'Northern Farm Cluster',
      'Doha Distribution Hub',
      'on-track',
      'Tomorrow 08:30',
      10
    ),
    (
      v_hassad_org_id,
      'HF-1044',
      'Poultry Feed',
      'Industrial Feed Mill',
      'Al Wakra Poultry Network',
      'watch',
      'Today 22:10',
      20
    ),
    (
      v_hassad_org_id,
      'HF-1098',
      'Greenhouse Cucumbers',
      'Umm Salal Controlled Farms',
      'West Bay Retail Chain',
      'risk',
      'Delayed +9h',
      30
    );

  DELETE FROM public.supply_action_queue WHERE organization_id = v_hassad_org_id;
  INSERT INTO public.supply_action_queue (
    organization_id,
    action_text,
    priority
  )
  VALUES
    (v_hassad_org_id, 'Validate delayed greenhouse corridor dispatches', 10),
    (v_hassad_org_id, 'Re-route poultry feed lots to south corridor', 20),
    (v_hassad_org_id, 'Confirm customs slot for imported grain shipment', 30);
END
$$;
