-- Qatar NFII 2.0 - SIMULATED SANDBOX operational seed
-- Data are fictional and are NOT government sources, official tenders, carrier confirmations, or real stock.
-- Compatible with migrations 00039 + 00040 + 00041. Executes server-side RPCs and generates audit events.
-- Run ONCE in a dedicated test Supabase project / isolated sandbox organization.
-- NO DROP, TRUNCATE, DELETE, UPDATE of production records. Entire seed is atomic.
--
-- AUTOMATIC SANDBOX SELECTION:
--  If exactly ONE organization contains both 'NFII' and 'SANDBOX/DEMO/SIMULATION',
--  and it has exactly TWO active members, the SQL selects them automatically.
--  Otherwise fill ALL THREE optional UUID overrides below (leave quoted UUIDs).
--  No production or ordinary organization may be selected.
-- Running this in SQL Editor is a DBA-only testing action. Real application operations must use the authorized API.

BEGIN;
DO $nfii_sim_ops$
DECLARE
  -- Optional explicit IDs. Leave all NULL for strict auto-selection.
  v_org_text TEXT := NULL;       -- e.g. '11111111-1111-4111-8111-111111111111'
  v_creator_text TEXT := NULL;   -- active test member UUID
  v_reviewer_text TEXT := NULL;  -- distinct active test member UUID
  v_candidates INTEGER;
  v_active_members INTEGER;
  v_org UUID;
  v_creator UUID;
  v_reviewer UUID;
  v_org_name TEXT;
  v_today DATE := (now() AT TIME ZONE 'Asia/Qatar')::date;
  v_item JSONB;
  v_result JSONB;
  v_id UUID;
  v_approval UUID;
  v_supplier_ids JSONB := '{}'::jsonb;
  v_contract_ids JSONB := '{}'::jsonb;
  v_order_ids JSONB := '{}'::jsonb;
  v_shipment_ids JSONB := '{}'::jsonb;
  v_warehouse_ids JSONB := '{}'::jsonb;
  v_lot_ids JSONB := '{}'::jsonb;
  v_note TEXT := 'SANDBOX SIMULATION ONLY: independently reviewed test fixture; NOT a legal order, real shipment, or physical inventory verification.';
BEGIN
  IF v_org_text IS NULL AND v_creator_text IS NULL AND v_reviewer_text IS NULL THEN
    SELECT count(*) INTO v_candidates
    FROM public.organizations o
    WHERE o.name ~* 'nfii' AND o.name ~* '(sandbox|demo|simulation)';
    IF v_candidates <> 1 THEN
      RAISE EXCEPTION USING MESSAGE = format(
        'AUTO-SELECTION STOP: found %s NFII sandbox organizations; expected exactly 1. Run 00_PRECHECK.sql or set all 3 optional UUID overrides.',
        v_candidates);
    END IF;
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE o.name ~* 'nfii' AND o.name ~* '(sandbox|demo|simulation)';
    SELECT count(*) INTO v_active_members
    FROM public.user_organization_members m
    WHERE m.organization_id=v_org AND m.status='active';
    IF v_active_members <> 2 THEN
      RAISE EXCEPTION USING MESSAGE = format(
        'AUTO-SELECTION STOP: NFII sandbox has %s active users; expected exactly 2. Run 00_PRECHECK.sql or set all 3 optional UUID overrides.',
        v_active_members);
    END IF;
    SELECT m.user_id INTO v_creator FROM public.user_organization_members m
    WHERE m.organization_id=v_org AND m.status='active' ORDER BY m.user_id ASC LIMIT 1;
    SELECT m.user_id INTO v_reviewer FROM public.user_organization_members m
    WHERE m.organization_id=v_org AND m.status='active' ORDER BY m.user_id DESC LIMIT 1;
  ELSE
    IF v_org_text IS NULL OR v_creator_text IS NULL OR v_reviewer_text IS NULL
       OR v_org_text !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR v_creator_text !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       OR v_reviewer_text !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Set ALL THREE explicit UUIDs in the optional overrides, or leave ALL as NULL';
    END IF;
    v_org := v_org_text::uuid;
    v_creator := v_creator_text::uuid;
    v_reviewer := v_reviewer_text::uuid;
  END IF;
  IF v_creator=v_reviewer THEN RAISE EXCEPTION 'Independent reviewer must differ from creator'; END IF;
  SELECT name INTO v_org_name FROM public.organizations WHERE id=v_org;
  IF v_org_name IS NULL OR v_org_name !~* '(sandbox|demo|simulation)' THEN
    RAISE EXCEPTION 'Refusing to seed: organization name must contain SANDBOX, DEMO or SIMULATION';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_organization_members
    WHERE organization_id=v_org AND user_id=v_creator AND status='active') OR
     NOT EXISTS(SELECT 1 FROM public.user_organization_members
    WHERE organization_id=v_org AND user_id=v_reviewer AND status='active') THEN
    RAISE EXCEPTION 'Both test actors must be ACTIVE members of the chosen sandbox organization';
  END IF;
  IF EXISTS (SELECT 1 FROM public.nfii_suppliers
    WHERE organization_id=v_org AND code LIKE 'SIMQA26-%') THEN
    RAISE EXCEPTION 'This sandbox already contains SIMQA26 sample records; do not run twice';
  END IF;
  RAISE NOTICE 'Seeding synthetic NFII Qatar scenario in sandbox organization: %',v_org_name;

  -- Suppliers: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"code":"VEG-QA-01","name":"SIMULATED | Qatar Protected Crops Network","country":"QA","review":"approved"},{"code":"DAIRY-QA-01","name":"SIMULATED | Doha Dairy Distribution","country":"QA","review":"approved"},{"code":"RICE-IN-01","name":"SIMULATED | South Asia Rice Procurement","country":"IN","review":"approved"},{"code":"RICE-PK-01","name":"SIMULATED | Indus Grain Export Trading","country":"PK","review":"approved"},{"code":"WHEAT-AU-01","name":"SIMULATED | Australian Cereal Exchange","country":"AU","review":"approved"},{"code":"BARLEY-DE-01","name":"SIMULATED | Northern Europe Feed Grains","country":"DE","review":"approved"},{"code":"PEPPER-TR-01","name":"SIMULATED | Anatolia Fresh Trade","country":"TR","review":"approved"},{"code":"DATES-OM-01","name":"SIMULATED | Oman Date Supply Partners","country":"OM","review":"approved"},{"code":"RICE-VN-02","name":"SIMULATED | Mekong Rice Supply Co","country":"VN","review":"approved"},{"code":"VEG-QA-02","name":"SIMULATED | Al Shamal Hydroponic Trading","country":"QA","review":"pending"}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'supplier',jsonb_build_object('code','SIMQA26-'||(v_item->>'code'),'name',v_item->>'name','countryCode',v_item->>'country'));
    v_id := (v_result->>'id')::uuid;
    v_supplier_ids := v_supplier_ids || jsonb_build_object(v_item->>'code', v_id::text);
    IF v_item->>'review'='approved' THEN
      SELECT id INTO v_approval FROM public.nfii_operation_approvals
      WHERE organization_id=v_org AND target_type='supplier' AND target_id=v_id;
      PERFORM public.nfii_review_operation(v_org,v_reviewer,v_approval,'approve',v_note);
    END IF;
    
  END LOOP;

  -- Supplier contracts: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"ref":"RICE-IN","supplier":"RICE-IN-01","commodity":"rice","quantity":500,"price":3800,"review":"approved"},{"ref":"RICE-PK","supplier":"RICE-PK-01","commodity":"rice","quantity":200,"price":3450,"review":"approved"},{"ref":"WHEAT-AU","supplier":"WHEAT-AU-01","commodity":"wheat","quantity":600,"price":1550,"review":"approved"},{"ref":"BARLEY-DE","supplier":"BARLEY-DE-01","commodity":"barley","quantity":450,"price":1450,"review":"approved"},{"ref":"TOMATO-QA","supplier":"VEG-QA-01","commodity":"tomato","quantity":135,"price":4250,"review":"approved"},{"ref":"CUCUMBER-QA","supplier":"VEG-QA-01","commodity":"cucumber","quantity":150,"price":3650,"review":"approved"},{"ref":"PEPPER-TR","supplier":"PEPPER-TR-01","commodity":"pepper","quantity":75,"price":6500,"review":"approved"},{"ref":"LETTUCE-QA","supplier":"VEG-QA-01","commodity":"lettuce","quantity":85,"price":5150,"review":"approved"},{"ref":"MILK-QA","supplier":"DAIRY-QA-01","commodity":"milk","quantity":800,"price":4800,"review":"approved"},{"ref":"DATES-OM","supplier":"DATES-OM-01","commodity":"date","quantity":100,"price":4700,"review":"approved"},{"ref":"RICE-VN-BACKUP","supplier":"RICE-VN-02","commodity":"rice","quantity":90,"price":3550,"review":"pending"}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'contract',jsonb_build_object('supplierId',v_supplier_ids->>(v_item->>'supplier'),'contractRef','SIMQA26-CTR-'||(v_item->>'ref'),'commodityCode',v_item->>'commodity','contractedTonnes',(v_item->>'quantity')::numeric,'priceQarPerTonne',(v_item->>'price')::numeric,'validFrom',(v_today-30)::text,'validTo',(v_today+360)::text));
    v_id := (v_result->>'id')::uuid;
    v_contract_ids := v_contract_ids || jsonb_build_object(v_item->>'ref', v_id::text);
    IF v_item->>'review'='approved' THEN
      SELECT id INTO v_approval FROM public.nfii_operation_approvals
      WHERE organization_id=v_org AND target_type='contract' AND target_id=v_id;
      PERFORM public.nfii_review_operation(v_org,v_reviewer,v_approval,'approve',v_note);
    END IF;
    
  END LOOP;

  -- Purchase orders: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"ref":"RICE-IN","contract":"RICE-IN","quantity":300,"review":"approved"},{"ref":"RICE-PK","contract":"RICE-PK","quantity":130,"review":"approved"},{"ref":"WHEAT-AU","contract":"WHEAT-AU","quantity":360,"review":"approved"},{"ref":"BARLEY-DE","contract":"BARLEY-DE","quantity":270,"review":"approved"},{"ref":"TOMATO-QA","contract":"TOMATO-QA","quantity":95,"review":"approved"},{"ref":"CUCUMBER-QA","contract":"CUCUMBER-QA","quantity":105,"review":"approved"},{"ref":"PEPPER-TR","contract":"PEPPER-TR","quantity":55,"review":"approved"},{"ref":"LETTUCE-QA","contract":"LETTUCE-QA","quantity":65,"review":"approved"},{"ref":"MILK-QA","contract":"MILK-QA","quantity":550,"review":"approved"},{"ref":"DATES-OM","contract":"DATES-OM","quantity":70,"review":"approved"}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'purchase_order',jsonb_build_object('contractId',v_contract_ids->>(v_item->>'contract'),'orderRef','SIMQA26-PO-'||(v_item->>'ref'),'orderedTonnes',(v_item->>'quantity')::numeric));
    v_id := (v_result->>'id')::uuid;
    v_order_ids := v_order_ids || jsonb_build_object(v_item->>'ref', v_id::text);
    IF v_item->>'review'='approved' THEN
      SELECT id INTO v_approval FROM public.nfii_operation_approvals
      WHERE organization_id=v_org AND target_type='purchase_order' AND target_id=v_id;
      PERFORM public.nfii_review_operation(v_org,v_reviewer,v_approval,'approve',v_note);
    END IF;
    
  END LOOP;

  -- Shipment tracking with manual state transitions: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"ref":"RICE-IN","order":"RICE-IN","quantity":250,"origin":"Nhava Sheva / Mumbai, India","destination":"Hamad Port, Qatar","eta":-1,"status":"delivered"},{"ref":"RICE-PK","order":"RICE-PK","quantity":110,"origin":"Karachi Port, Pakistan","destination":"Hamad Port, Qatar","eta":9,"status":"planned"},{"ref":"WHEAT-AU","order":"WHEAT-AU","quantity":300,"origin":"Fremantle, Australia","destination":"Hamad Port, Qatar","eta":14,"status":"in_transit"},{"ref":"BARLEY-DE","order":"BARLEY-DE","quantity":220,"origin":"Hamburg Port, Germany","destination":"Hamad Port, Qatar","eta":-2,"status":"delivered"},{"ref":"TOMATO-QA","order":"TOMATO-QA","quantity":75,"origin":"Al Khor protected farms, Qatar","destination":"Doha fresh produce hub, Qatar","eta":-1,"status":"delivered"},{"ref":"CUCUMBER-QA","order":"CUCUMBER-QA","quantity":85,"origin":"Al Shamal farms, Qatar","destination":"Doha fresh produce hub, Qatar","eta":4,"status":"planned"},{"ref":"PEPPER-TR","order":"PEPPER-TR","quantity":50,"origin":"Mersin Port, Turkey","destination":"Hamad Port, Qatar","eta":-2,"status":"delayed"},{"ref":"LETTUCE-QA","order":"LETTUCE-QA","quantity":50,"origin":"Al Khor hydroponics, Qatar","destination":"Doha chilled distribution, Qatar","eta":-1,"status":"delivered"},{"ref":"MILK-QA","order":"MILK-QA","quantity":450,"origin":"Umm Salal cold chain, Qatar","destination":"Doha dairy distribution, Qatar","eta":1,"status":"in_transit"},{"ref":"DATES-OM","order":"DATES-OM","quantity":60,"origin":"Nizwa consolidated foods, Oman","destination":"Doha distribution, Qatar","eta":11,"status":"planned"}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'shipment',jsonb_build_object('purchaseOrderId',v_order_ids->>(v_item->>'order'),'shipmentRef','SIMQA26-BL-'||(v_item->>'ref'),'shipmentTonnes',(v_item->>'quantity')::numeric,'origin',v_item->>'origin','destination',v_item->>'destination','etaDate',(v_today+(v_item->>'eta')::int)::text));
    v_id := (v_result->>'id')::uuid;
    v_shipment_ids := v_shipment_ids || jsonb_build_object(v_item->>'ref', v_id::text);
    IF v_item->>'status' IN ('in_transit','delivered') THEN
      PERFORM public.nfii_transition_shipment(v_org,v_reviewer,v_id,'in_transit',v_note);
    END IF;
    IF v_item->>'status'='delivered' THEN
      PERFORM public.nfii_transition_shipment(v_org,v_reviewer,v_id,'delivered',v_note);
    ELSIF v_item->>'status'='delayed' THEN
      PERFORM public.nfii_transition_shipment(v_org,v_reviewer,v_id,'delayed',v_note);
    END IF;
    
  END LOOP;

  -- Warehouse network: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"code":"DOHA-DRY","name":"SIMULATED | Doha Dry Goods Depot","location":"Doha Industrial Area, Qatar"},{"code":"MESAIEED-CHILL","name":"SIMULATED | Mesaieed Chilled Warehouse","location":"Mesaieed Logistics District, Qatar"},{"code":"ALKHOR-COLD","name":"SIMULATED | Al Khor Perishables Store","location":"Al Khor, Qatar"}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'warehouse',jsonb_build_object('code','SIMQA26-'||(v_item->>'code'),'name',v_item->>'name','location',v_item->>'location'));
    v_id := (v_result->>'id')::uuid;
    v_warehouse_ids := v_warehouse_ids || jsonb_build_object(v_item->>'code', v_id::text);
    SELECT id INTO v_approval FROM public.nfii_operation_approvals
    WHERE organization_id=v_org AND target_type='warehouse' AND target_id=v_id;
    PERFORM public.nfii_review_operation(v_org,v_reviewer,v_approval,'approve',v_note);
    
  END LOOP;

  -- Delivered shipment receipts into approved warehouse lots: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"ref":"RICE-A","warehouse":"DOHA-DRY","shipment":"RICE-IN","quantity":130,"expiryDays":360},{"ref":"RICE-B","warehouse":"DOHA-DRY","shipment":"RICE-IN","quantity":95,"expiryDays":365},{"ref":"BARLEY-A","warehouse":"DOHA-DRY","shipment":"BARLEY-DE","quantity":200,"expiryDays":260},{"ref":"TOMATO-A","warehouse":"MESAIEED-CHILL","shipment":"TOMATO-QA","quantity":68,"expiryDays":11},{"ref":"LETTUCE-A","warehouse":"ALKHOR-COLD","shipment":"LETTUCE-QA","quantity":46,"expiryDays":7}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'lot',jsonb_build_object('warehouseId',v_warehouse_ids->>(v_item->>'warehouse'),'shipmentId',v_shipment_ids->>(v_item->>'shipment'),'lotRef','SIMQA26-LOT-'||(v_item->>'ref'),'receivedTonnes',(v_item->>'quantity')::numeric,'expiryDate',(v_today+(v_item->>'expiryDays')::int)::text));
    v_id := (v_result->>'id')::uuid;
    v_lot_ids := v_lot_ids || jsonb_build_object(v_item->>'ref', v_id::text);
    SELECT id INTO v_approval FROM public.nfii_operation_approvals
    WHERE organization_id=v_org AND target_type='lot' AND target_id=v_id;
    PERFORM public.nfii_review_operation(v_org,v_reviewer,v_approval,'approve',v_note);
    
  END LOOP;

  -- Controlled reserve release proposals: all new records are labeled SIMQA26 and tied to sandbox UUIDs.
  FOR v_item IN SELECT value FROM jsonb_array_elements($fixtures$[{"ref":"RICE-EMERGENCY","lot":"RICE-A","quantity":35,"purpose":"SIMULATION ONLY: dry food reserve release to Doha distribution operators","review":"executed"},{"ref":"RICE-REPLENISH","lot":"RICE-B","quantity":20,"purpose":"SIMULATION ONLY: contingency allocation held pending dispatch","review":"approved"},{"ref":"BARLEY-FEED","lot":"BARLEY-A","quantity":30,"purpose":"SIMULATION ONLY: livestock feed resilience contingency assessment","review":"pending"},{"ref":"LETTUCE-FEFO","lot":"LETTUCE-A","quantity":10,"purpose":"SIMULATION ONLY: FEFO release to refrigerated local distribution","review":"executed"}]$fixtures$::jsonb) LOOP
    v_result := public.nfii_create_operation(v_org,v_creator,'release',jsonb_build_object('lotId',v_lot_ids->>(v_item->>'lot'),'releaseRef','SIMQA26-REL-'||(v_item->>'ref'),'quantityTonnes',(v_item->>'quantity')::numeric,'purpose',v_item->>'purpose'));
    v_id := (v_result->>'id')::uuid;
    -- Release id recorded in SQL audit event; no map needed.
    IF v_item->>'review' IN ('approved','executed') THEN
      SELECT id INTO v_approval FROM public.nfii_operation_approvals
      WHERE organization_id=v_org AND target_type='release' AND target_id=v_id;
      PERFORM public.nfii_review_operation(v_org,v_reviewer,v_approval,'approve',v_note);
      IF v_item->>'review'='executed' THEN
        PERFORM public.nfii_execute_reserve_release(v_org,v_reviewer,v_id,v_note);
      END IF;
    END IF;
    
  END LOOP;

  RAISE NOTICE 'SIMQA26 operational seed committed: suppliers, contracts, POs, shipments, warehouses, lots and releases. No outside transactions executed.';
END;
$nfii_sim_ops$;
COMMIT;
