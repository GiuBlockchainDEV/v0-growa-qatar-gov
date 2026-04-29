-- Persist custom map points and crop types in database.

CREATE TABLE IF NOT EXISTS public.custom_map_points (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  point_type TEXT NOT NULL DEFAULT 'custom',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_map_points_user_id_idx
  ON public.custom_map_points(user_id);

CREATE INDEX IF NOT EXISTS custom_map_points_type_idx
  ON public.custom_map_points(point_type);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_map_points_point_type_check'
  ) THEN
    ALTER TABLE public.custom_map_points
    ADD CONSTRAINT custom_map_points_point_type_check
    CHECK (point_type IN ('custom', 'farm', 'facility', 'sensor'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_map_points_lat_check'
  ) THEN
    ALTER TABLE public.custom_map_points
    ADD CONSTRAINT custom_map_points_lat_check
    CHECK (lat BETWEEN -90 AND 90);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_map_points_lng_check'
  ) THEN
    ALTER TABLE public.custom_map_points
    ADD CONSTRAINT custom_map_points_lng_check
    CHECK (lng BETWEEN -180 AND 180);
  END IF;
END $$;

ALTER TABLE public.custom_map_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_map_points_select_own ON public.custom_map_points;
CREATE POLICY custom_map_points_select_own
  ON public.custom_map_points
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_map_points_insert_own ON public.custom_map_points;
CREATE POLICY custom_map_points_insert_own
  ON public.custom_map_points
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_map_points_update_own ON public.custom_map_points;
CREATE POLICY custom_map_points_update_own
  ON public.custom_map_points
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_map_points_delete_own ON public.custom_map_points;
CREATE POLICY custom_map_points_delete_own
  ON public.custom_map_points
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.custom_crop_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_crop_types_user_id_idx
  ON public.custom_crop_types(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_crop_types_user_normalized_name_key'
  ) THEN
    ALTER TABLE public.custom_crop_types
    ADD CONSTRAINT custom_crop_types_user_normalized_name_key
    UNIQUE (user_id, normalized_name);
  END IF;
END $$;

ALTER TABLE public.custom_crop_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_crop_types_select_own ON public.custom_crop_types;
CREATE POLICY custom_crop_types_select_own
  ON public.custom_crop_types
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_crop_types_insert_own ON public.custom_crop_types;
CREATE POLICY custom_crop_types_insert_own
  ON public.custom_crop_types
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_crop_types_update_own ON public.custom_crop_types;
CREATE POLICY custom_crop_types_update_own
  ON public.custom_crop_types
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS custom_crop_types_delete_own ON public.custom_crop_types;
CREATE POLICY custom_crop_types_delete_own
  ON public.custom_crop_types
  FOR DELETE
  USING (auth.uid() = user_id);

-- Seed crop types from existing custom point polygons.
INSERT INTO public.custom_crop_types (user_id, name, normalized_name)
SELECT
  p.user_id,
  TRIM(p.crop_name) AS name,
  LOWER(TRIM(p.crop_name)) AS normalized_name
FROM public.custom_point_polygons p
WHERE COALESCE(TRIM(p.crop_name), '') <> ''
ON CONFLICT (user_id, normalized_name) DO NOTHING;
