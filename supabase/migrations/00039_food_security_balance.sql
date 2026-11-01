-- NFII v2 initial food security accounting. Non-destructive, per-organization.
-- Data is not national by default; no real food volume is seeded here.
-- Demo mode uses a separate, in-memory fixture in the application.

CREATE TABLE IF NOT EXISTS public.food_commodities (
  code TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  category TEXT NOT NULL,
  base_unit TEXT NOT NULL DEFAULT 't' CHECK (base_unit = 't'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.food_commodities (code, name_en, name_ar, category) VALUES
  ('tomato', 'Tomato', 'طماطم', 'vegetable'),
  ('cucumber', 'Cucumber', 'خيار', 'vegetable'),
  ('pepper', 'Pepper', 'فلفل', 'vegetable'),
  ('lettuce', 'Lettuce', 'خس', 'vegetable'),
  ('date', 'Date', 'تمر', 'fruit'),
  ('barley', 'Barley', 'شعير', 'grain'),
  ('milk', 'Milk', 'حليب', 'livestock'),
  ('rice', 'Rice', 'أرز', 'grain'),
  ('wheat', 'Wheat', 'قمح', 'grain')
ON CONFLICT (code) DO NOTHING;

-- One aggregated end-of-day usable stock position per organization/commodity.
-- Facility-level inventory and national federated aggregation are future layers.
CREATE TABLE IF NOT EXISTS public.food_balance_stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  commodity_code TEXT NOT NULL REFERENCES public.food_commodities(code),
  as_of_date DATE NOT NULL,
  usable_tonnes NUMERIC(18,3) NOT NULL CHECK (usable_tonnes >= 0),
  source_ref TEXT NOT NULL CHECK (length(trim(source_ref)) > 0),
  data_mode TEXT NOT NULL CHECK (data_mode IN ('observed', 'estimated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, commodity_code, as_of_date)
);

-- An external_key prevents re-ingesting a source movement twice.
-- Inflows and outflows refer to events AFTER the opening inventory snapshot.
CREATE TABLE IF NOT EXISTS public.food_balance_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  commodity_code TEXT NOT NULL REFERENCES public.food_commodities(code),
  external_key TEXT NOT NULL CHECK (length(trim(external_key)) > 0),
  flow_type TEXT NOT NULL CHECK (flow_type IN ('domestic_production', 'confirmed_import', 'consumption', 'loss')),
  effective_date DATE NOT NULL,
  quantity_tonnes NUMERIC(18,3) NOT NULL CHECK (quantity_tonnes >= 0),
  source_ref TEXT NOT NULL CHECK (length(trim(source_ref)) > 0),
  data_mode TEXT NOT NULL CHECK (data_mode IN ('observed', 'estimated', 'forecast')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_key)
);

-- Declared period completeness is essential. No rows does not mean zero flow.
-- Only COMPLETE declarations are sufficient to calculate a definitive category total.
CREATE TABLE IF NOT EXISTS public.food_balance_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  commodity_code TEXT NOT NULL REFERENCES public.food_commodities(code),
  flow_type TEXT NOT NULL CHECK (flow_type IN ('domestic_production', 'confirmed_import', 'consumption', 'loss')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('complete', 'partial')),
  source_ref TEXT NOT NULL CHECK (length(trim(source_ref)) > 0),
  data_mode TEXT NOT NULL CHECK (data_mode IN ('observed', 'estimated', 'forecast')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date),
  UNIQUE (organization_id, commodity_code, flow_type, start_date, end_date, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_food_stock_org_commodity_date
  ON public.food_balance_stock_snapshots (organization_id, commodity_code, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_food_flow_org_commodity_date
  ON public.food_balance_flows (organization_id, commodity_code, effective_date);
CREATE INDEX IF NOT EXISTS idx_food_coverage_org_commodity_period
  ON public.food_balance_coverage (organization_id, commodity_code, start_date, end_date);

ALTER TABLE public.food_commodities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_balance_stock_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_balance_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_balance_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS food_commodities_read ON public.food_commodities;
CREATE POLICY food_commodities_read ON public.food_commodities
  FOR SELECT TO authenticated USING (TRUE);

-- These RLS policies intentionally omit viewer, inspector, agronomist and
-- technical-support roles, which do not have supply.view in the auth registry.
-- Backend also enforces supply.view and the explicitly chosen tenant.
-- Future delegated/cross-organization access requires a separately audited policy.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'food_balance_stock_snapshots',
    'food_balance_flows',
    'food_balance_coverage'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS food_balance_read ON public.%I', table_name);
    EXECUTE format($policy$
      CREATE POLICY food_balance_read ON public.%I
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.user_organization_members m
          WHERE m.organization_id = %I.organization_id
            AND m.user_id = auth.uid()
            AND m.status = 'active'
            AND lower(m.role) IN (
              'owner', 'admin', 'super_admin', 'member', 'operator', 'editor',
              'analyst', 'farm_manager', 'farm_company_admin',
              'ministry_officer', 'ministry_admin', 'ministry_super_admin',
              'sourcing_manager', 'supply_chain_officer', 'hassad_admin',
              'finance_officer', 'credit_analyst', 'qdb_admin'
            )
        )
      )
    $policy$, table_name, table_name);
  END LOOP;
END
$$;

-- The application does not provide user-facing writes in this phase.
-- Service-backed ingestion should be separately authorized, validated and audited.
-- Supabase projects may grant DML to authenticated via default privileges.
-- Revoke writes explicitly; only vetted server-side ingestion may write later.
REVOKE ALL ON public.food_commodities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.food_balance_stock_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.food_balance_flows FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.food_balance_coverage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.food_commodities TO authenticated;
GRANT SELECT ON public.food_balance_stock_snapshots TO authenticated;
GRANT SELECT ON public.food_balance_flows TO authenticated;
GRANT SELECT ON public.food_balance_coverage TO authenticated;
