-- NFII 2.0 | ICPS operational ledger. Apply AFTER 00040.
-- All records start empty; no demo data, mock government feeds or auto-procurement.
-- Tenant-specific, service-RPC-only writes; authenticated users have SELECT under RLS.

CREATE TABLE IF NOT EXISTS public.nfii_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 3 AND 60),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 200),
  country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,code)
);

CREATE TABLE IF NOT EXISTS public.nfii_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  supplier_id UUID NOT NULL,
  contract_ref TEXT NOT NULL CHECK (length(contract_ref) BETWEEN 3 AND 80),
  commodity_code TEXT NOT NULL REFERENCES public.food_commodities(code),
  contracted_tonnes NUMERIC(18,3) NOT NULL CHECK (contracted_tonnes > 0),
  price_qar_per_tonne NUMERIC(18,2) NOT NULL CHECK (price_qar_per_tonne > 0),
  valid_from DATE NOT NULL, valid_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_to >= valid_from),
  UNIQUE (organization_id,id), UNIQUE (organization_id,contract_ref),
  FOREIGN KEY (organization_id,supplier_id)
    REFERENCES public.nfii_suppliers(organization_id,id)
);

CREATE TABLE IF NOT EXISTS public.nfii_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  contract_id UUID NOT NULL,
  order_ref TEXT NOT NULL CHECK (length(order_ref) BETWEEN 3 AND 80),
  ordered_tonnes NUMERIC(18,3) NOT NULL CHECK (ordered_tonnes > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,order_ref),
  FOREIGN KEY (organization_id,contract_id)
    REFERENCES public.nfii_contracts(organization_id,id)
);

CREATE TABLE IF NOT EXISTS public.nfii_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  purchase_order_id UUID NOT NULL,
  shipment_ref TEXT NOT NULL CHECK (length(shipment_ref) BETWEEN 3 AND 80),
  shipment_tonnes NUMERIC(18,3) NOT NULL CHECK (shipment_tonnes > 0),
  origin TEXT NOT NULL CHECK (length(trim(origin)) BETWEEN 3 AND 160),
  destination TEXT NOT NULL CHECK (length(trim(destination)) BETWEEN 3 AND 160),
  eta_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_transit','delayed','delivered','cancelled')),
  delivered_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,shipment_ref),
  FOREIGN KEY (organization_id,purchase_order_id)
    REFERENCES public.nfii_purchase_orders(organization_id,id)
);

CREATE TABLE IF NOT EXISTS public.nfii_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  code TEXT NOT NULL CHECK (length(code) BETWEEN 3 AND 60),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 160),
  location TEXT NOT NULL CHECK (length(trim(location)) BETWEEN 3 AND 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,code)
);

CREATE TABLE IF NOT EXISTS public.nfii_reserve_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  warehouse_id UUID NOT NULL,
  shipment_id UUID NOT NULL,
  lot_ref TEXT NOT NULL CHECK (length(lot_ref) BETWEEN 3 AND 80),
  commodity_code TEXT NOT NULL REFERENCES public.food_commodities(code),
  received_tonnes NUMERIC(18,3) NOT NULL CHECK (received_tonnes > 0),
  released_tonnes NUMERIC(18,3) NOT NULL DEFAULT 0 CHECK (released_tonnes >= 0 AND released_tonnes <= received_tonnes),
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,lot_ref),
  FOREIGN KEY (organization_id,warehouse_id)
    REFERENCES public.nfii_warehouses(organization_id,id),
  FOREIGN KEY (organization_id,shipment_id)
    REFERENCES public.nfii_shipments(organization_id,id)
);

CREATE TABLE IF NOT EXISTS public.nfii_reserve_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  lot_id UUID NOT NULL,
  release_ref TEXT NOT NULL CHECK (length(release_ref) BETWEEN 3 AND 80),
  quantity_tonnes NUMERIC(18,3) NOT NULL CHECK (quantity_tonnes > 0),
  purpose TEXT NOT NULL CHECK (length(trim(purpose)) BETWEEN 8 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','executed')),
  executed_by UUID REFERENCES auth.users(id),
  executed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id), UNIQUE (organization_id,release_ref),
  FOREIGN KEY (organization_id,lot_id)
    REFERENCES public.nfii_reserve_lots(organization_id,id)
);

-- Requests are generated atomically when source entities are created.
-- A unique target prevents multiple conflicting review requests.
CREATE TABLE IF NOT EXISTS public.nfii_operation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  target_type TEXT NOT NULL CHECK (
    target_type IN ('supplier','contract','purchase_order','warehouse','lot','release')),
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,target_type,target_id)
);

CREATE TABLE IF NOT EXISTS public.nfii_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('supplier','contract','purchase_order','shipment','warehouse','lot','release','approval')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN ('created','submitted','approved','rejected','in_transit','delayed','delivered','cancelled','executed')),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nfii_approvals_org_status
  ON public.nfii_operation_approvals(organization_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfii_events_org_created
  ON public.nfii_operation_events(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfii_shipments_org_status
  ON public.nfii_shipments(organization_id,status,eta_date);
CREATE INDEX IF NOT EXISTS idx_nfii_lots_org_warehouse
  ON public.nfii_reserve_lots(organization_id,warehouse_id,commodity_code,expiry_date);

DO $rls$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'nfii_suppliers','nfii_contracts','nfii_purchase_orders','nfii_shipments',
    'nfii_warehouses','nfii_reserve_lots','nfii_reserve_releases',
    'nfii_operation_approvals','nfii_operation_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('DROP POLICY IF EXISTS nfii_org_read ON public.%I',table_name);
    EXECUTE format($policy$
      CREATE POLICY nfii_org_read ON public.%I FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.user_organization_members m
        WHERE m.organization_id = %I.organization_id
          AND m.user_id = (SELECT auth.uid())
          AND m.status = 'active'
          AND lower(m.role) IN (
            'owner','admin','super_admin','member','operator','editor',
            'analyst','farm_manager','farm_company_admin',
            'ministry_officer','ministry_admin','ministry_super_admin',
            'sourcing_manager','supply_chain_officer','hassad_admin',
            'finance_officer','credit_analyst','qdb_admin'
          )
      ))
    $policy$,table_name,table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',table_name);
  END LOOP;
END
$rls$;

-- All writes, review transitions and operational status changes are performed
-- through service-role-only RPCs with explicit server-side capability checks.
CREATE OR REPLACE FUNCTION public.nfii_assert_operational_actor(p_org UUID,p_actor UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF p_org IS NULL OR p_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE organization_id=p_org AND user_id=p_actor AND status='active'
  ) THEN
    RAISE EXCEPTION 'Active organization membership required';
  END IF;
END;
$function$;

-- Reject attempts to tamper with the audit ledger, including as service_role.
CREATE OR REPLACE FUNCTION public.nfii_reject_event_changes()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'NFII operational audit records are immutable';
END;
$function$;
DROP TRIGGER IF EXISTS nfii_events_no_changes ON public.nfii_operation_events;
CREATE TRIGGER nfii_events_no_changes BEFORE UPDATE OR DELETE
  ON public.nfii_operation_events
  FOR EACH ROW EXECUTE FUNCTION public.nfii_reject_event_changes();

-- Create typed operational records from validated server payloads.
-- Important: SQL transaction encompasses new record, approval request and audit.
CREATE OR REPLACE FUNCTION public.nfii_create_operation(
  p_org UUID, p_actor UUID, p_kind TEXT, p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_id UUID;
  v_parent RECORD;
  v_other RECORD;
  v_total NUMERIC(18,3);
  v_qty NUMERIC(18,3);
  v_needs_review BOOLEAN := true;
  v_status TEXT := 'pending';
  v_commodity TEXT;
BEGIN
  PERFORM public.nfii_assert_operational_actor(p_org,p_actor);
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Invalid operation payload';
  END IF;

  IF p_kind='supplier' THEN
    INSERT INTO public.nfii_suppliers
      (organization_id,code,name,country_code,created_by)
    VALUES (p_org,p_payload->>'code',p_payload->>'name',
      p_payload->>'countryCode',p_actor)
    RETURNING id INTO v_id;

  ELSIF p_kind='contract' THEN
    SELECT id,status INTO v_parent FROM public.nfii_suppliers
    WHERE organization_id=p_org AND id=(p_payload->>'supplierId')::uuid FOR SHARE;
    IF NOT FOUND OR v_parent.status<>'approved' THEN
      RAISE EXCEPTION 'An approved supplier in this organization is required';
    END IF;
    INSERT INTO public.nfii_contracts
      (organization_id,supplier_id,contract_ref,commodity_code,
       contracted_tonnes,price_qar_per_tonne,valid_from,valid_to,created_by)
    VALUES (
      p_org,v_parent.id,p_payload->>'contractRef',p_payload->>'commodityCode',
      (p_payload->>'contractedTonnes')::numeric,(p_payload->>'priceQarPerTonne')::numeric,
      (p_payload->>'validFrom')::date,(p_payload->>'validTo')::date,p_actor)
    RETURNING id INTO v_id;

  ELSIF p_kind='purchase_order' THEN
    SELECT id,status,contracted_tonnes INTO v_parent FROM public.nfii_contracts
    WHERE organization_id=p_org AND id=(p_payload->>'contractId')::uuid FOR SHARE;
    IF NOT FOUND OR v_parent.status<>'approved' THEN
      RAISE EXCEPTION 'An approved contract is required';
    END IF;
    INSERT INTO public.nfii_purchase_orders
      (organization_id,contract_id,order_ref,ordered_tonnes,created_by)
    VALUES (p_org,v_parent.id,p_payload->>'orderRef',
      (p_payload->>'orderedTonnes')::numeric,p_actor)
    RETURNING id INTO v_id;

  ELSIF p_kind='shipment' THEN
    SELECT id,status,ordered_tonnes INTO v_parent FROM public.nfii_purchase_orders
    WHERE organization_id=p_org AND id=(p_payload->>'purchaseOrderId')::uuid
    FOR UPDATE;
    IF NOT FOUND OR v_parent.status<>'approved' THEN
      RAISE EXCEPTION 'Shipment requires an approved purchase order';
    END IF;
    v_qty := (p_payload->>'shipmentTonnes')::numeric;
    SELECT COALESCE(SUM(shipment_tonnes),0) INTO v_total
    FROM public.nfii_shipments WHERE organization_id=p_org
      AND purchase_order_id=v_parent.id AND status<>'cancelled';
    IF v_qty<=0 OR v_total+v_qty>v_parent.ordered_tonnes THEN
      RAISE EXCEPTION 'Shipments exceed approved purchase order volume';
    END IF;
    INSERT INTO public.nfii_shipments
      (organization_id,purchase_order_id,shipment_ref,shipment_tonnes,
       origin,destination,eta_date,created_by)
    VALUES (p_org,v_parent.id,p_payload->>'shipmentRef',v_qty,
      p_payload->>'origin',p_payload->>'destination',
      (p_payload->>'etaDate')::date,p_actor)
    RETURNING id INTO v_id;
    v_needs_review := false;
    v_status := 'planned';

  ELSIF p_kind='warehouse' THEN
    INSERT INTO public.nfii_warehouses
      (organization_id,code,name,location,created_by)
    VALUES (p_org,p_payload->>'code',p_payload->>'name',
      p_payload->>'location',p_actor)
    RETURNING id INTO v_id;

  ELSIF p_kind='lot' THEN
    SELECT id,status INTO v_other FROM public.nfii_warehouses
    WHERE organization_id=p_org AND id=(p_payload->>'warehouseId')::uuid FOR SHARE;
    IF NOT FOUND OR v_other.status<>'approved' THEN
      RAISE EXCEPTION 'An approved warehouse is required';
    END IF;
    SELECT s.id,s.status,s.shipment_tonnes,c.commodity_code
      INTO v_parent
    FROM public.nfii_shipments s
    JOIN public.nfii_purchase_orders po ON po.id=s.purchase_order_id
       AND po.organization_id=s.organization_id
    JOIN public.nfii_contracts c ON c.id=po.contract_id
       AND c.organization_id=po.organization_id
    WHERE s.organization_id=p_org AND s.id=(p_payload->>'shipmentId')::uuid
    FOR UPDATE OF s;
    IF NOT FOUND OR v_parent.status<>'delivered' THEN
      RAISE EXCEPTION 'A delivered shipment is required for physical lot receipt';
    END IF;
    v_qty := (p_payload->>'receivedTonnes')::numeric;
    SELECT COALESCE(SUM(received_tonnes),0) INTO v_total
    FROM public.nfii_reserve_lots WHERE organization_id=p_org
      AND shipment_id=v_parent.id AND status<>'rejected';
    IF v_qty<=0 OR v_total+v_qty>v_parent.shipment_tonnes THEN
      RAISE EXCEPTION 'Lot receipts exceed the delivered shipment quantity';
    END IF;
    INSERT INTO public.nfii_reserve_lots
      (organization_id,warehouse_id,shipment_id,lot_ref,commodity_code,
       received_tonnes,expiry_date,created_by)
    VALUES (p_org,v_other.id,v_parent.id,p_payload->>'lotRef',
      v_parent.commodity_code,v_qty,(p_payload->>'expiryDate')::date,p_actor)
    RETURNING id INTO v_id;

  ELSIF p_kind='release' THEN
    SELECT id,status,received_tonnes,released_tonnes,expiry_date
      INTO v_parent FROM public.nfii_reserve_lots
    WHERE organization_id=p_org AND id=(p_payload->>'lotId')::uuid FOR SHARE;
    IF NOT FOUND OR v_parent.status<>'approved' THEN
      RAISE EXCEPTION 'A verified, approved reserve lot is required';
    END IF;
    IF v_parent.expiry_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cannot request an expired reserve lot';
    END IF;
    v_qty := (p_payload->>'quantityTonnes')::numeric;
    IF v_qty<=0 OR v_qty > v_parent.received_tonnes - v_parent.released_tonnes THEN
      RAISE EXCEPTION 'Requested release exceeds currently available lot quantity';
    END IF;
    INSERT INTO public.nfii_reserve_releases
      (organization_id,lot_id,release_ref,quantity_tonnes,purpose,created_by)
    VALUES (p_org,v_parent.id,p_payload->>'releaseRef',v_qty,
      p_payload->>'purpose',p_actor)
    RETURNING id INTO v_id;

  ELSE
    RAISE EXCEPTION 'Unknown NFII operation kind';
  END IF;

  IF v_needs_review THEN
    INSERT INTO public.nfii_operation_approvals
      (organization_id,target_type,target_id,submitted_by)
    VALUES (p_org,p_kind,v_id,p_actor);
  END IF;

  INSERT INTO public.nfii_operation_events
    (organization_id,entity_type,entity_id,action,actor_id,details)
  VALUES (p_org,p_kind,v_id,'created',p_actor,
    jsonb_build_object('initial_status',v_status));

  RETURN jsonb_build_object('kind',p_kind,'id',v_id,'status',v_status);
END;
$function$;

-- Independent reviewer and transaction-safe parent/quantity verification.
CREATE OR REPLACE FUNCTION public.nfii_review_operation(
  p_org UUID, p_actor UUID, p_approval_id UUID,
  p_decision TEXT, p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_review public.nfii_operation_approvals%ROWTYPE;
  v_status TEXT;
  v_record RECORD;
  v_parent RECORD;
  v_total NUMERIC(18,3);
BEGIN
  PERFORM public.nfii_assert_operational_actor(p_org,p_actor);
  IF p_decision NOT IN ('approve','reject') OR length(trim(coalesce(p_reason,''))) < 8
    OR length(p_reason)>2000 THEN
    RAISE EXCEPTION 'Valid review decision and reason required';
  END IF;
  SELECT * INTO v_review FROM public.nfii_operation_approvals
    WHERE organization_id=p_org AND id=p_approval_id FOR UPDATE;
  IF NOT FOUND OR v_review.status<>'pending' THEN
    RAISE EXCEPTION 'Pending approval request not found';
  END IF;
  IF v_review.submitted_by=p_actor THEN
    RAISE EXCEPTION 'Independent review required; proposer cannot approve their own record';
  END IF;
  v_status:=CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END;

  IF v_review.target_type='supplier' THEN
    UPDATE public.nfii_suppliers SET status=v_status
      WHERE organization_id=p_org AND id=v_review.target_id AND status='pending';

  ELSIF v_review.target_type='warehouse' THEN
    UPDATE public.nfii_warehouses SET status=v_status
      WHERE organization_id=p_org AND id=v_review.target_id AND status='pending';

  ELSIF v_review.target_type='contract' THEN
    SELECT * INTO v_record FROM public.nfii_contracts
      WHERE organization_id=p_org AND id=v_review.target_id FOR UPDATE;
    IF NOT FOUND OR v_record.status<>'pending' THEN RAISE EXCEPTION 'Contract not pending'; END IF;
    IF v_status='approved' AND NOT EXISTS (
      SELECT 1 FROM public.nfii_suppliers WHERE organization_id=p_org
        AND id=v_record.supplier_id AND status='approved'
    ) THEN RAISE EXCEPTION 'Contract supplier is not approved'; END IF;
    UPDATE public.nfii_contracts SET status=v_status
      WHERE organization_id=p_org AND id=v_review.target_id;

  ELSIF v_review.target_type='purchase_order' THEN
    SELECT * INTO v_record FROM public.nfii_purchase_orders
      WHERE organization_id=p_org AND id=v_review.target_id FOR UPDATE;
    IF NOT FOUND OR v_record.status<>'pending' THEN RAISE EXCEPTION 'Order not pending'; END IF;
    IF v_status='approved' THEN
      SELECT id,status,contracted_tonnes,valid_from,valid_to INTO v_parent
      FROM public.nfii_contracts
      WHERE organization_id=p_org AND id=v_record.contract_id FOR UPDATE;
      IF NOT FOUND OR v_parent.status<>'approved' THEN
        RAISE EXCEPTION 'Order contract not approved';
      END IF;
      IF CURRENT_DATE < v_parent.valid_from OR CURRENT_DATE>v_parent.valid_to THEN
        RAISE EXCEPTION 'Contract outside its validity period';
      END IF;
      SELECT COALESCE(SUM(ordered_tonnes),0) INTO v_total
      FROM public.nfii_purchase_orders
      WHERE organization_id=p_org AND contract_id=v_parent.id
        AND status='approved';
      IF v_total + v_record.ordered_tonnes > v_parent.contracted_tonnes THEN
        RAISE EXCEPTION 'Approved orders would exceed contracted capacity';
      END IF;
    END IF;
    UPDATE public.nfii_purchase_orders SET status=v_status
      WHERE organization_id=p_org AND id=v_review.target_id;

  ELSIF v_review.target_type='lot' THEN
    SELECT * INTO v_record FROM public.nfii_reserve_lots
      WHERE organization_id=p_org AND id=v_review.target_id FOR UPDATE;
    IF NOT FOUND OR v_record.status<>'pending' THEN RAISE EXCEPTION 'Lot not pending'; END IF;
    IF v_status='approved' AND v_record.expiry_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cannot approve an expired lot';
    END IF;
    UPDATE public.nfii_reserve_lots SET status=v_status
      WHERE organization_id=p_org AND id=v_review.target_id;

  ELSIF v_review.target_type='release' THEN
    SELECT * INTO v_record FROM public.nfii_reserve_releases
      WHERE organization_id=p_org AND id=v_review.target_id FOR UPDATE;
    IF NOT FOUND OR v_record.status<>'pending' THEN RAISE EXCEPTION 'Release not pending'; END IF;
    IF v_status='approved' THEN
      SELECT id,status,received_tonnes,released_tonnes,expiry_date INTO v_parent
      FROM public.nfii_reserve_lots
      WHERE organization_id=p_org AND id=v_record.lot_id FOR UPDATE;
      IF NOT FOUND OR v_parent.status<>'approved' OR v_parent.expiry_date<CURRENT_DATE THEN
        RAISE EXCEPTION 'Reserve lot unavailable or expired';
      END IF;
      SELECT COALESCE(SUM(quantity_tonnes),0) INTO v_total
      FROM public.nfii_reserve_releases
      WHERE organization_id=p_org AND lot_id=v_parent.id
        AND status IN ('approved','executed');
      IF v_total + v_record.quantity_tonnes > v_parent.received_tonnes THEN
        RAISE EXCEPTION 'Reserve commitments exceed usable lot quantity';
      END IF;
    END IF;
    UPDATE public.nfii_reserve_releases SET status=v_status
      WHERE organization_id=p_org AND id=v_review.target_id;
  ELSE
    RAISE EXCEPTION 'Unsupported approval target';
  END IF;

  UPDATE public.nfii_operation_approvals SET
    status=v_status,reviewed_by=p_actor,reviewed_at=now(),review_note=trim(p_reason)
    WHERE id=v_review.id AND organization_id=p_org;
  INSERT INTO public.nfii_operation_events
    (organization_id,entity_type,entity_id,action,actor_id,details)
  VALUES (p_org,v_review.target_type,v_review.target_id,v_status,p_actor,
    jsonb_build_object('approval_id',v_review.id,'reason',trim(p_reason)));
  RETURN jsonb_build_object('kind',v_review.target_type,
    'id',v_review.target_id,'status',v_status);
END;
$function$;

-- A shipment is an administrative tracking record; no carrier API is invoked.
CREATE OR REPLACE FUNCTION public.nfii_transition_shipment(
  p_org UUID,p_actor UUID,p_shipment_id UUID,p_next TEXT,p_note TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_record public.nfii_shipments%ROWTYPE;
BEGIN
  PERFORM public.nfii_assert_operational_actor(p_org,p_actor);
  IF length(trim(coalesce(p_note,'')))<8 OR length(p_note)>2000 THEN
    RAISE EXCEPTION 'A documented tracking note is required';
  END IF;
  SELECT * INTO v_record FROM public.nfii_shipments
    WHERE organization_id=p_org AND id=p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found in organization'; END IF;
  IF NOT (
    (v_record.status='planned' AND p_next IN ('in_transit','delayed','cancelled')) OR
    (v_record.status='in_transit' AND p_next IN ('delivered','delayed','cancelled')) OR
    (v_record.status='delayed' AND p_next IN ('in_transit','delivered','cancelled'))
  ) THEN RAISE EXCEPTION 'Invalid shipment state transition'; END IF;
  UPDATE public.nfii_shipments
    SET status=p_next,
      delivered_at=CASE WHEN p_next='delivered' THEN now() ELSE NULL END
    WHERE organization_id=p_org AND id=p_shipment_id;
  INSERT INTO public.nfii_operation_events
    (organization_id,entity_type,entity_id,action,actor_id,details)
  VALUES (p_org,'shipment',p_shipment_id,p_next,p_actor,
    jsonb_build_object('previous',v_record.status,'note',trim(p_note)));
  RETURN jsonb_build_object('kind','shipment','id',p_shipment_id,'status',p_next);
END;
$function$;

-- Physical release is recorded only AFTER independent approval. Transactional
-- row lock prevents overselling if multiple executors act concurrently.
CREATE OR REPLACE FUNCTION public.nfii_execute_reserve_release(
  p_org UUID,p_actor UUID,p_release_id UUID,p_note TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_release public.nfii_reserve_releases%ROWTYPE;
  v_lot public.nfii_reserve_lots%ROWTYPE;
BEGIN
  PERFORM public.nfii_assert_operational_actor(p_org,p_actor);
  IF length(trim(coalesce(p_note,'')))<8 OR length(p_note)>2000 THEN
    RAISE EXCEPTION 'Release execution requires a documented note';
  END IF;
  SELECT * INTO v_release FROM public.nfii_reserve_releases
    WHERE organization_id=p_org AND id=p_release_id FOR UPDATE;
  IF NOT FOUND OR v_release.status<>'approved' THEN
    RAISE EXCEPTION 'Only approved reserve releases may be executed';
  END IF;
  IF v_release.created_by=p_actor THEN
    RAISE EXCEPTION 'Release proposer cannot execute their own request';
  END IF;
  SELECT * INTO v_lot FROM public.nfii_reserve_lots
    WHERE organization_id=p_org AND id=v_release.lot_id FOR UPDATE;
  IF NOT FOUND OR v_lot.status<>'approved' OR v_lot.expiry_date<CURRENT_DATE THEN
    RAISE EXCEPTION 'Reserve lot no longer available';
  END IF;
  IF v_lot.released_tonnes + v_release.quantity_tonnes > v_lot.received_tonnes THEN
    RAISE EXCEPTION 'Release would exceed physical lot balance';
  END IF;
  UPDATE public.nfii_reserve_lots SET released_tonnes=released_tonnes+v_release.quantity_tonnes
    WHERE organization_id=p_org AND id=v_lot.id;
  UPDATE public.nfii_reserve_releases SET
    status='executed',executed_by=p_actor,executed_at=now()
    WHERE organization_id=p_org AND id=v_release.id;
  INSERT INTO public.nfii_operation_events
    (organization_id,entity_type,entity_id,action,actor_id,details)
  VALUES (p_org,'release',p_release_id,'executed',p_actor,
    jsonb_build_object('quantity_tonnes',v_release.quantity_tonnes,
      'lot_id',v_lot.id,'note',trim(p_note)));
  RETURN jsonb_build_object('kind','release','id',p_release_id,
    'status','executed','quantity_tonnes',v_release.quantity_tonnes);
END;
$function$;

-- Restrict all DEFINER RPC calls to the service role ONLY; the server must
-- check supply.edit, decisions.approve, or decisions.execute BEFORE calling.
REVOKE ALL ON FUNCTION public.nfii_assert_operational_actor(UUID,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nfii_reject_event_changes() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nfii_create_operation(UUID,UUID,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nfii_review_operation(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nfii_transition_shipment(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nfii_execute_reserve_release(UUID,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nfii_assert_operational_actor(UUID,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.nfii_create_operation(UUID,UUID,TEXT,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.nfii_review_operation(UUID,UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.nfii_transition_shipment(UUID,UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.nfii_execute_reserve_release(UUID,UUID,UUID,TEXT) TO service_role;
