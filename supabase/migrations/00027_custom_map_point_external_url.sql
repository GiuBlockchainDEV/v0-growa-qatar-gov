-- Store an optional external page link directly on each custom map point/farm.
ALTER TABLE public.custom_map_points
ADD COLUMN IF NOT EXISTS external_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_map_points_external_url_check'
  ) THEN
    ALTER TABLE public.custom_map_points
    ADD CONSTRAINT custom_map_points_external_url_check
    CHECK (
      external_url IS NULL
      OR external_url = ''
      OR external_url ~* '^https?://'
    );
  END IF;
END $$;
