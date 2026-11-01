-- NFII Qatar SIMULATED sandbox source submission, not official statistical data.
-- Inserts 9 opening stock snapshots, 576 flow blocks,
-- and 36 declared source coverages: ALL initially PENDING_REVIEW.
-- The Watchtower will deliberately NOT use these as verified national facts.
-- Source labels SIMQA26/... and the SANDBOX organization name clearly identify fiction.
-- Run in the same sandbox and on the same Doha calendar day as the operational seed.
-- If exactly ONE NFII sandbox exists with TWO active members, actor IDs are auto-resolved.
-- Otherwise enter both optional UUID overrides below.
-- Never use these source rows in a production tenant.

BEGIN;
DO $nfii_sim_food$
DECLARE
  -- Optional overrides; leave both NULL for strict auto-selection.
  v_org_text TEXT := NULL;        -- sandbox organization UUID, only if needed
  v_submitter_text TEXT := NULL;  -- active test member UUID, only if needed
  v_candidates INTEGER;
  v_active_members INTEGER;
  v_org UUID;
  v_submitter UUID;
  v_name TEXT;
  v_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::date;
  v_item JSONB;
  v_segment JSONB;
  v_type TEXT;
  v_rate NUMERIC;
  v_multiplier NUMERIC;
  v_offset INT;
  v_span INT;
  v_source TEXT;
BEGIN
  IF v_org_text IS NULL AND v_submitter_text IS NULL THEN
    SELECT count(*) INTO v_candidates FROM public.organizations o
    WHERE o.name ~* 'nfii' AND o.name ~* '(sandbox|demo|simulation)';
    IF v_candidates <> 1 THEN
      RAISE EXCEPTION USING MESSAGE = format(
        'AUTO-SELECTION STOP: found %s NFII sandbox organizations; expected exactly 1. Run 00_PRECHECK.sql or set both optional UUID overrides.',
        v_candidates);
    END IF;
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE o.name ~* 'nfii' AND o.name ~* '(sandbox|demo|simulation)';
    SELECT count(*) INTO v_active_members
    FROM public.user_organization_members m
    WHERE m.organization_id=v_org AND m.status='active';
    IF v_active_members <> 2 THEN
      RAISE EXCEPTION USING MESSAGE = format(
        'AUTO-SELECTION STOP: NFII sandbox has %s active users; expected exactly 2. Run 00_PRECHECK.sql or set both optional UUID overrides.',
        v_active_members);
    END IF;
    SELECT m.user_id INTO v_submitter FROM public.user_organization_members m
    WHERE m.organization_id=v_org AND m.status='active' ORDER BY m.user_id ASC LIMIT 1;
  ELSE
    IF v_org_text IS NULL OR v_submitter_text IS NULL
       OR v_org_text !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR v_submitter_text !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Set BOTH explicit UUIDs in the optional overrides, or leave BOTH as NULL';
    END IF;
    v_org := v_org_text::uuid;
    v_submitter := v_submitter_text::uuid;
  END IF;
  SELECT name INTO v_name FROM public.organizations WHERE id=v_org;
  IF v_name IS NULL OR v_name !~* '(sandbox|demo|simulation)' THEN
    RAISE EXCEPTION 'Refusing to seed: use a dedicated SANDBOX / DEMO organization only';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_organization_members
      WHERE organization_id=v_org AND user_id=v_submitter AND status='active') THEN
    RAISE EXCEPTION 'Submitter must be an active sandbox organization member';
  END IF;
  IF EXISTS(SELECT 1 FROM public.food_balance_stock_snapshots
      WHERE organization_id=v_org AND source_ref LIKE 'SIMQA26/%') OR
     EXISTS(SELECT 1 FROM public.food_balance_flows
      WHERE organization_id=v_org AND external_key LIKE 'SIMQA26-%') OR
     EXISTS(SELECT 1 FROM public.food_balance_coverage
      WHERE organization_id=v_org AND source_ref LIKE 'SIMQA26/%') THEN
    RAISE EXCEPTION 'This sandbox already has SIMQA26 source data. Do not reseed.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"commodity":"tomato","opening":45,"domestic_production":2.1,"confirmed_import":1.3,"consumption":4.0,"loss":0.12},{"commodity":"cucumber","opening":70,"domestic_production":2.5,"confirmed_import":0.8,"consumption":3.0,"loss":0.1},{"commodity":"pepper","opening":25,"domestic_production":0.25,"confirmed_import":1.5,"consumption":1.7,"loss":0.06},{"commodity":"lettuce","opening":20,"domestic_production":1.3,"confirmed_import":0.25,"consumption":1.6,"loss":0.07},{"commodity":"date","opening":105,"domestic_production":0.3,"confirmed_import":0.4,"consumption":0.9,"loss":0.02},{"commodity":"barley","opening":350,"domestic_production":0.05,"confirmed_import":9.0,"consumption":10.0,"loss":0.08},{"commodity":"milk","opening":35,"domestic_production":12.0,"confirmed_import":0.15,"consumption":12.3,"loss":0.2},{"commodity":"rice","opening":320,"domestic_production":0,"confirmed_import":7.0,"consumption":9.0,"loss":0.06},{"commodity":"wheat","opening":250,"domestic_production":0,"confirmed_import":4.5,"consumption":4.8,"loss":0.05}]$fixtures$::jsonb) LOOP
    v_source := 'SIMQA26/SYNTHETIC-PLANNING/' || (v_item->>'commodity');
    INSERT INTO public.food_balance_stock_snapshots
      (organization_id,commodity_code,as_of_date,usable_tonnes,
       source_ref,data_mode,source_kind,verification_status,submitted_by)
    VALUES (v_org,v_item->>'commodity',v_today-1,(v_item->>'opening')::numeric,
      v_source||'/OPENING','estimated','manual','pending_review',v_submitter);

    FOREACH v_type IN ARRAY ARRAY['domestic_production','confirmed_import','consumption','loss'] LOOP
      INSERT INTO public.food_balance_coverage
        (organization_id,commodity_code,flow_type,start_date,end_date,status,
         source_ref,data_mode,source_kind,verification_status,submitted_by)
      VALUES (v_org,v_item->>'commodity',v_type,v_today,v_today+179,'complete',
        v_source||'/COVERAGE/'||v_type,'forecast','manual','pending_review',v_submitter);

      v_rate := (v_item->>v_type)::numeric;
      FOR v_segment IN SELECT value FROM jsonb_array_elements($fixtures$[{"offset":0,"span":1},{"offset":1,"span":1},{"offset":2,"span":1},{"offset":3,"span":1},{"offset":4,"span":1},{"offset":5,"span":1},{"offset":6,"span":1},{"offset":7,"span":7},{"offset":14,"span":7},{"offset":21,"span":7},{"offset":28,"span":2},{"offset":30,"span":30},{"offset":60,"span":30},{"offset":90,"span":30},{"offset":120,"span":30},{"offset":150,"span":30}]$fixtures$::jsonb) LOOP
        v_offset := (v_segment->>'offset')::int;
        v_span := (v_segment->>'span')::int;
        v_multiplier := 1;
        -- Doha vegetable seasonality: protected production strongest in cooler months.
        IF v_item->>'commodity' IN ('tomato','cucumber','pepper','lettuce') THEN
          IF v_type='domestic_production' THEN
            v_multiplier := CASE WHEN v_offset<90 THEN 1.10
                                 WHEN v_offset<150 THEN 0.75 ELSE 0.45 END;
          ELSIF v_type='confirmed_import' THEN
            v_multiplier := CASE WHEN v_offset<90 THEN 0.90
                                 WHEN v_offset<150 THEN 1.15 ELSE 1.40 END;
          END IF;
        END IF;
        INSERT INTO public.food_balance_flows
          (organization_id,commodity_code,external_key,flow_type,effective_date,
           quantity_tonnes,source_ref,data_mode,source_kind,verification_status,submitted_by)
        VALUES (
          v_org, v_item->>'commodity',
          'SIMQA26-'||(v_item->>'commodity')||'-'||v_type||'-'||lpad(v_offset::text,3,'0'),
          v_type,v_today+v_offset,round(v_rate*v_span*v_multiplier,3),
          v_source||'/FLOW/'||v_type,'forecast','manual','pending_review',v_submitter
        );
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Submitted synthetic food rows as pending_review ONLY. Never auto-verify invented sources.';
END;
$nfii_sim_food$;
COMMIT;
