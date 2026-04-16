-- Farm company operational field logbook (Italian "quaderno di campagna" inspired).
-- Enables read/insert/update workflows for field-level agronomic records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.farm_logbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.farm_logbook_entries
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS activity_category TEXT NOT NULL DEFAULT 'Monitoring',
  ADD COLUMN IF NOT EXISTS operation_title TEXT NOT NULL DEFAULT 'Field operation',
  ADD COLUMN IF NOT EXISTS crop_name TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS active_substance TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS treated_area NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS area_unit TEXT DEFAULT 'ha',
  ADD COLUMN IF NOT EXISTS weather_conditions TEXT,
  ADD COLUMN IF NOT EXISTS operator_name TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'farm_logbook_entries_activity_category_check'
      AND conrelid = 'public.farm_logbook_entries'::regclass
  ) THEN
    ALTER TABLE public.farm_logbook_entries
      ADD CONSTRAINT farm_logbook_entries_activity_category_check
      CHECK (
        activity_category IN (
          'Planting',
          'Fertilization',
          'Irrigation',
          'Plant Protection',
          'Harvest',
          'Soil Work',
          'Monitoring',
          'Other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'farm_logbook_entries_status_check'
      AND conrelid = 'public.farm_logbook_entries'::regclass
  ) THEN
    ALTER TABLE public.farm_logbook_entries
      ADD CONSTRAINT farm_logbook_entries_status_check
      CHECK (status IN ('draft', 'completed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS farm_logbook_entries_org_date_idx
  ON public.farm_logbook_entries(organization_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS farm_logbook_entries_farm_date_idx
  ON public.farm_logbook_entries(farm_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS farm_logbook_entries_category_idx
  ON public.farm_logbook_entries(activity_category);

CREATE OR REPLACE FUNCTION public.set_farm_logbook_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farm_logbook_entries_updated_at ON public.farm_logbook_entries;
CREATE TRIGGER trg_farm_logbook_entries_updated_at
  BEFORE UPDATE ON public.farm_logbook_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_farm_logbook_entries_updated_at();

ALTER TABLE public.farm_logbook_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'farm_logbook_entries'
      AND policyname = 'farm_logbook_entries_select_members'
  ) THEN
    CREATE POLICY "farm_logbook_entries_select_members"
      ON public.farm_logbook_entries
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = farm_logbook_entries.organization_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'farm_logbook_entries'
      AND policyname = 'farm_logbook_entries_insert_writers'
  ) THEN
    CREATE POLICY "farm_logbook_entries_insert_writers"
      ON public.farm_logbook_entries
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = farm_logbook_entries.organization_id
            AND m.role IN (
              'owner',
              'admin',
              'farm_company_admin',
              'farm_manager',
              'agronomist',
              'operator',
              'editor'
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'farm_logbook_entries'
      AND policyname = 'farm_logbook_entries_update_writers'
  ) THEN
    CREATE POLICY "farm_logbook_entries_update_writers"
      ON public.farm_logbook_entries
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = farm_logbook_entries.organization_id
            AND m.role IN (
              'owner',
              'admin',
              'farm_company_admin',
              'farm_manager',
              'agronomist',
              'operator',
              'editor'
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_organization_members m
          WHERE m.user_id = auth.uid()
            AND m.organization_id = farm_logbook_entries.organization_id
            AND m.role IN (
              'owner',
              'admin',
              'farm_company_admin',
              'farm_manager',
              'agronomist',
              'operator',
              'editor'
            )
        )
      );
  END IF;
END
$$;
