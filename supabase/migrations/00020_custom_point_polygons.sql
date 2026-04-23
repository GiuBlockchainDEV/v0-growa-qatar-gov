-- Store user-defined polygons linked to custom map points.
CREATE TABLE IF NOT EXISTS public.custom_point_polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_point_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vertices JSONB NOT NULL DEFAULT '[]'::jsonb,
  crop_name TEXT,
  crop_variety TEXT,
  sowing_date DATE,
  expected_harvest_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_point_polygons_user_id_idx
  ON public.custom_point_polygons(user_id);

CREATE INDEX IF NOT EXISTS custom_point_polygons_point_id_idx
  ON public.custom_point_polygons(custom_point_id);

ALTER TABLE public.custom_point_polygons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_point_polygons_select_own ON public.custom_point_polygons;
CREATE POLICY custom_point_polygons_select_own
  ON public.custom_point_polygons
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_point_polygons_insert_own ON public.custom_point_polygons;
CREATE POLICY custom_point_polygons_insert_own
  ON public.custom_point_polygons
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_point_polygons_update_own ON public.custom_point_polygons;
CREATE POLICY custom_point_polygons_update_own
  ON public.custom_point_polygons
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_point_polygons_delete_own ON public.custom_point_polygons;
CREATE POLICY custom_point_polygons_delete_own
  ON public.custom_point_polygons
  FOR DELETE
  USING (auth.uid() = user_id);
