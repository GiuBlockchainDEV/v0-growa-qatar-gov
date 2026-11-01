-- NFII v2: operator-source intake, independent review and immutable audit.
-- Apply after 00039. No existing inventory/flows are deleted or certified.
-- Previously stored rows become pending_review until independently attested.

DO $migration$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'food_balance_stock_snapshots',
    'food_balance_flows',
    'food_balance_coverage'
  ] LOOP
    EXECUTE format($ddl$
      ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'legacy'
          CHECK (source_kind IN ('legacy', 'manual', 'csv', 'api')),
        ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending_review'
          CHECK (verification_status IN ('pending_review', 'verified', 'rejected')),
        ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS review_note TEXT
    $ddl$, table_name);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id, commodity_code, verification_status)',
      'idx_' || table_name || '_review', table_name
    );
  END LOOP;
END
$migration$;

-- Service-role-only audit ledger. Normal authenticated clients have no access.
CREATE TABLE IF NOT EXISTS public.food_balance_record_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  commodity_code TEXT NOT NULL REFERENCES public.food_commodities(code),
  record_table TEXT NOT NULL CHECK (
    record_table IN ('food_balance_stock_snapshots', 'food_balance_flows', 'food_balance_coverage')
  ),
  record_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted', 'verified', 'rejected')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_balance_record_events_org
  ON public.food_balance_record_events (organization_id, commodity_code, created_at DESC);

ALTER TABLE public.food_balance_record_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.food_balance_record_events FROM PUBLIC, anon, authenticated;

-- Source contents are immutable: review may change status only once.
-- Corrections require a separately sourced replacement/reconciliation procedure.
CREATE OR REPLACE FUNCTION public.guard_food_balance_source_changes()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = ''
AS $guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Food source records cannot be deleted; use an audited correction workflow';
  END IF;

  IF (to_jsonb(NEW) - 'verification_status' - 'reviewed_by' - 'reviewed_at' - 'review_note')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'verification_status' - 'reviewed_by' - 'reviewed_at' - 'review_note') THEN
    RAISE EXCEPTION 'Food source contents are immutable';
  END IF;

  IF OLD.verification_status <> 'pending_review'
     OR NEW.verification_status NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid food source review transition';
  END IF;

  IF NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL
     OR length(trim(coalesce(NEW.review_note, ''))) < 8 THEN
    RAISE EXCEPTION 'Food source review requires reviewer, timestamp and explanation';
  END IF;

  IF NEW.submitted_by IS NOT NULL AND NEW.submitted_by = NEW.reviewed_by THEN
    RAISE EXCEPTION 'Food source submitter cannot approve or reject their own submission';
  END IF;

  RETURN NEW;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.audit_food_balance_source_changes()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $audit$
BEGIN
  INSERT INTO public.food_balance_record_events (
    organization_id, commodity_code, record_table, record_id,
    event_type, actor_id, details
  )
  VALUES (
    NEW.organization_id, NEW.commodity_code, TG_TABLE_NAME, NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'submitted' ELSE NEW.verification_status END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.submitted_by ELSE NEW.reviewed_by END,
    pg_catalog.jsonb_build_object(
      'source_ref', NEW.source_ref,
      'source_kind', NEW.source_kind,
      'data_mode', NEW.data_mode,
      'verification_status', NEW.verification_status,
      'review_note', NEW.review_note
    )
  );
  RETURN NEW;
END;
$audit$;

REVOKE ALL ON FUNCTION public.guard_food_balance_source_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_food_balance_source_changes() FROM PUBLIC;

DO $triggers$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'food_balance_stock_snapshots',
    'food_balance_flows',
    'food_balance_coverage'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_food_source_guard ON public.%I', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_food_source_audit ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_food_source_guard BEFORE UPDATE OR DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.guard_food_balance_source_changes()', table_name
    );
    EXECUTE format(
      'CREATE TRIGGER trg_food_source_audit AFTER INSERT OR UPDATE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.audit_food_balance_source_changes()', table_name
    );
  END LOOP;
END
$triggers$;

-- 00039 already revoked direct authenticated writes on source tables.
-- Preserve that prohibition explicitly for projects with altered grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.food_balance_stock_snapshots FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.food_balance_flows FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.food_balance_coverage FROM PUBLIC, anon, authenticated;
