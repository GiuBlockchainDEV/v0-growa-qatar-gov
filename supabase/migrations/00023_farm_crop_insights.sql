-- Store farm crop insights for each custom farm point.
CREATE TABLE IF NOT EXISTS public.farm_crop_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_point_id TEXT NOT NULL,
  crop_name TEXT NOT NULL,
  estimated_production_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
  energy_consumption_kwh NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_consumption_m3 NUMERIC(12,2) NOT NULL DEFAULT 0,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS farm_crop_insights_user_id_idx
  ON public.farm_crop_insights(user_id);

CREATE INDEX IF NOT EXISTS farm_crop_insights_point_id_idx
  ON public.farm_crop_insights(custom_point_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'farm_crop_insights_non_negative_check'
  ) THEN
    ALTER TABLE public.farm_crop_insights
    ADD CONSTRAINT farm_crop_insights_non_negative_check
    CHECK (
      estimated_production_tons >= 0
      AND energy_consumption_kwh >= 0
      AND water_consumption_m3 >= 0
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'farm_crop_insights_external_url_check'
  ) THEN
    ALTER TABLE public.farm_crop_insights
    ADD CONSTRAINT farm_crop_insights_external_url_check
    CHECK (
      external_url IS NULL
      OR external_url ~* '^https?://'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'farm_crop_insights_user_point_crop_key'
  ) THEN
    ALTER TABLE public.farm_crop_insights
    ADD CONSTRAINT farm_crop_insights_user_point_crop_key
    UNIQUE (user_id, custom_point_id, crop_name);
  END IF;
END $$;

ALTER TABLE public.farm_crop_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_crop_insights_select_own ON public.farm_crop_insights;
CREATE POLICY farm_crop_insights_select_own
  ON public.farm_crop_insights
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS farm_crop_insights_insert_own ON public.farm_crop_insights;
CREATE POLICY farm_crop_insights_insert_own
  ON public.farm_crop_insights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS farm_crop_insights_update_own ON public.farm_crop_insights;
CREATE POLICY farm_crop_insights_update_own
  ON public.farm_crop_insights
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS farm_crop_insights_delete_own ON public.farm_crop_insights;
CREATE POLICY farm_crop_insights_delete_own
  ON public.farm_crop_insights
  FOR DELETE
  USING (auth.uid() = user_id);

-- Seed insight rows from existing polygons when crop names are present.
INSERT INTO public.farm_crop_insights (
  user_id,
  custom_point_id,
  crop_name,
  estimated_production_tons,
  energy_consumption_kwh,
  water_consumption_m3,
  external_url
)
SELECT
  s.user_id,
  s.custom_point_id,
  s.crop_name,
  ROUND((25 + (ROW_NUMBER() OVER (ORDER BY s.custom_point_id, s.crop_name) * 1.5))::NUMERIC, 2),
  ROUND((110 + (ROW_NUMBER() OVER (ORDER BY s.custom_point_id, s.crop_name) * 7.25))::NUMERIC, 2),
  ROUND((90 + (ROW_NUMBER() OVER (ORDER BY s.custom_point_id, s.crop_name) * 4.4))::NUMERIC, 2),
  NULL
FROM (
  SELECT DISTINCT
    p.user_id,
    p.custom_point_id,
    NULLIF(TRIM(p.crop_name), '') AS crop_name
  FROM public.custom_point_polygons p
) s
WHERE s.crop_name IS NOT NULL
ON CONFLICT (user_id, custom_point_id, crop_name) DO NOTHING;
