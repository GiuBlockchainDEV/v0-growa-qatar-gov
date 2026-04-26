-- Add agronomic score (0-100) for custom point polygons.
ALTER TABLE public.custom_point_polygons
ADD COLUMN IF NOT EXISTS score NUMERIC(5,2) NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_point_polygons_score_check'
  ) THEN
    ALTER TABLE public.custom_point_polygons
    ADD CONSTRAINT custom_point_polygons_score_check
    CHECK (score >= 0 AND score <= 100);
  END IF;
END $$;
