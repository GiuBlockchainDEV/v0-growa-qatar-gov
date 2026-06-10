-- Store production and resource metrics on each individual polygon.
ALTER TABLE public.custom_point_polygons
ADD COLUMN IF NOT EXISTS estimated_production_tons NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS energy_consumption_kwh NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS water_consumption_m3 NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_point_polygons_metrics_non_negative_check'
  ) THEN
    ALTER TABLE public.custom_point_polygons
    ADD CONSTRAINT custom_point_polygons_metrics_non_negative_check
    CHECK (
      estimated_production_tons >= 0
      AND energy_consumption_kwh >= 0
      AND water_consumption_m3 >= 0
    );
  END IF;
END $$;

-- Preserve existing farm/crop totals by splitting them evenly across matching polygons.
DO $$
BEGIN
  IF to_regclass('public.farm_crop_insights') IS NOT NULL THEN
    WITH polygon_counts AS (
      SELECT
        user_id,
        custom_point_id,
        NULLIF(TRIM(crop_name), '') AS crop_name,
        COUNT(*)::NUMERIC AS polygon_count
      FROM public.custom_point_polygons
      WHERE NULLIF(TRIM(crop_name), '') IS NOT NULL
      GROUP BY user_id, custom_point_id, NULLIF(TRIM(crop_name), '')
    )
    UPDATE public.custom_point_polygons polygon
    SET
      estimated_production_tons = ROUND(insight.estimated_production_tons / counts.polygon_count, 2),
      energy_consumption_kwh = ROUND(insight.energy_consumption_kwh / counts.polygon_count, 2),
      water_consumption_m3 = ROUND(insight.water_consumption_m3 / counts.polygon_count, 2),
      updated_at = NOW()
    FROM public.farm_crop_insights insight
    JOIN polygon_counts counts
      ON counts.user_id = insight.user_id
      AND counts.custom_point_id = insight.custom_point_id
      AND counts.crop_name = NULLIF(TRIM(insight.crop_name), '')
    WHERE polygon.user_id = insight.user_id
      AND polygon.custom_point_id = insight.custom_point_id
      AND NULLIF(TRIM(polygon.crop_name), '') = NULLIF(TRIM(insight.crop_name), '')
      AND polygon.estimated_production_tons = 0
      AND polygon.energy_consumption_kwh = 0
      AND polygon.water_consumption_m3 = 0;
  END IF;
END $$;
