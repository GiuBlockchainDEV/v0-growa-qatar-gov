-- Massive synthetic seed data across core modules.
-- Safe to run multiple times: inserts are guarded with ON CONFLICT / NOT EXISTS checks.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_users_count INT := 0;
  v_org_count INT := 0;
  v_primary_user UUID;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Seed organizations across all supported types.
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_seed_orgs (
    name TEXT,
    slug TEXT,
    description TEXT,
    organization_type TEXT,
    tier INT
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_orgs (name, slug, description, organization_type, tier)
  VALUES
    ('Qatar Ministry of Municipality', 'qatar-ministry-municipality', 'National agriculture and municipal governance', 'government_master', 5),
    ('Qatar Agriculture Regulatory Office', 'qatar-agri-regulatory-office', 'Inspection and compliance authority', 'government', 4),
    ('Hassad Food', 'hassad-food', 'Strategic sourcing and food supply operations', 'private', 4),
    ('QDB Agri Financing Unit', 'qdb-agri-financing-unit', 'Agricultural financing and risk programs', 'public', 4),
    ('Qatar Fresh Farms Group', 'qatar-fresh-farms-group', 'Large scale mixed production cluster', 'farm_company', 3),
    ('Desert Bloom Cooperative', 'desert-bloom-cooperative', 'Greenhouse and hydroponic federation', 'farm_company', 3),
    ('Pearl Livestock Partners', 'pearl-livestock-partners', 'Integrated poultry and dairy network', 'farm_company', 3),
    ('Doha Wholesale Market Authority', 'doha-wholesale-market-authority', 'Distribution and market coordination', 'public', 2),
    ('Al Khor Water Efficiency Lab', 'al-khor-water-efficiency-lab', 'Water optimization and irrigation R&D', 'government', 2),
    ('National Cold Chain Program', 'national-cold-chain-program', 'National refrigerated logistics backbone', 'public', 3),
    ('Gulf Agro Trading', 'gulf-agro-trading', 'Regional commodity procurement and import desk', 'private', 2),
    ('Urban Food Security Taskforce', 'urban-food-security-taskforce', 'Cross-agency planning and response unit', 'government', 3);

  INSERT INTO public.organizations (
    name,
    slug,
    description,
    type,
    organization_type
  )
  SELECT
    s.name,
    s.slug,
    s.description,
    s.organization_type,
    s.organization_type
  FROM tmp_seed_orgs s
  ON CONFLICT (slug) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    type = COALESCE(NULLIF(public.organizations.type, ''), EXCLUDED.type),
    organization_type = COALESCE(NULLIF(public.organizations.organization_type, ''), EXCLUDED.organization_type);

  CREATE TEMP TABLE tmp_org_map ON COMMIT DROP AS
  SELECT
    o.id,
    o.slug,
    COALESCE(NULLIF(o.organization_type, ''), NULLIF(o.type, ''), 'private') AS organization_type,
    ROW_NUMBER() OVER (ORDER BY o.slug, o.id) AS org_rank
  FROM public.organizations o
  JOIN tmp_seed_orgs s ON s.slug = o.slug;

  -- ---------------------------------------------------------------------------
  -- Pull existing users from auth.users (seed only for available accounts).
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_seed_users ON COMMIT DROP AS
  SELECT
    u.id,
    COALESCE(NULLIF(u.email, ''), 'user-' || SUBSTRING(u.id::text, 1, 8) || '@demo.local') AS email,
    ROW_NUMBER() OVER (ORDER BY u.created_at NULLS LAST, u.id) AS user_rank
  FROM auth.users u
  LIMIT 80;

  SELECT COUNT(*) INTO v_users_count FROM tmp_seed_users;
  SELECT COUNT(*) INTO v_org_count FROM tmp_org_map;
  SELECT id INTO v_primary_user FROM tmp_seed_users ORDER BY user_rank LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- Seed role navigation catalog (broad role coverage).
  -- ---------------------------------------------------------------------------
  INSERT INTO public.role_navigation (
    role_name,
    display_name,
    landing_page,
    menu_items,
    description
  )
  VALUES
    (
      'viewer',
      'Viewer',
      '/dashboard',
      '[{"id":"live-map","label":"Live Map","path":"/dashboard?module=live-map"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Read-only baseline role'
    ),
    (
      'ministry_admin',
      'Ministry Admin',
      '/dashboard',
      '[{"id":"national-overview","label":"National Overview","path":"/dashboard?module=national-overview"},{"id":"inspection-readiness","label":"Inspection Readiness","path":"/dashboard?module=inspection-readiness"},{"id":"policy-control","label":"Policy Control","path":"/dashboard?module=policy-control"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'National governance workspace'
    ),
    (
      'ministry_officer',
      'Ministry Officer',
      '/dashboard',
      '[{"id":"inspection-dashboard","label":"Inspection Dashboard","path":"/dashboard?module=inspection-dashboard"},{"id":"incident-register","label":"Incident Register","path":"/dashboard?module=incident-register"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Inspection and enforcement operations'
    ),
    (
      'sourcing_manager',
      'Sourcing Manager',
      '/dashboard/supply-overview',
      '[{"id":"supply-overview","label":"Supply Overview","path":"/dashboard/supply-overview"},{"id":"contract-board","label":"Contract Board","path":"/dashboard?module=contract-board"},{"id":"supplier-network","label":"Supplier Network","path":"/dashboard?module=supplier-network"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Hassad sourcing operations'
    ),
    (
      'hassad_admin',
      'Hassad Admin',
      '/dashboard/supply-overview',
      '[{"id":"supply-overview","label":"Supply Overview","path":"/dashboard/supply-overview"},{"id":"risk-heatmap","label":"Risk Heatmap","path":"/dashboard?module=risk-heatmap"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Executive oversight for Hassad'
    ),
    (
      'qdb_admin',
      'QDB Admin',
      '/dashboard',
      '[{"id":"portfolio-overview","label":"Portfolio Overview","path":"/dashboard?module=portfolio-overview"},{"id":"credit-pipeline","label":"Credit Pipeline","path":"/dashboard?module=credit-pipeline"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Financing and portfolio governance'
    ),
    (
      'credit_analyst',
      'Credit Analyst',
      '/dashboard',
      '[{"id":"credit-pipeline","label":"Credit Pipeline","path":"/dashboard?module=credit-pipeline"},{"id":"risk-scoring","label":"Risk Scoring","path":"/dashboard?module=risk-scoring"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Loan assessment and scoring'
    ),
    (
      'farm_company_admin',
      'Farm Company Admin',
      '/dashboard',
      '[{"id":"farm-control-tower","label":"Farm Control Tower","path":"/dashboard?module=farm-control-tower"},{"id":"operations-plan","label":"Operations Plan","path":"/dashboard?module=operations-plan"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Farm company management role'
    ),
    (
      'farm_manager',
      'Farm Manager',
      '/dashboard',
      '[{"id":"field-operations","label":"Field Operations","path":"/dashboard?module=field-operations"},{"id":"resource-planner","label":"Resource Planner","path":"/dashboard?module=resource-planner"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Daily farm operations'
    ),
    (
      'agronomist',
      'Agronomist',
      '/dashboard',
      '[{"id":"crop-intelligence","label":"Crop Intelligence","path":"/dashboard?module=crop-intelligence"},{"id":"soil-health","label":"Soil Health","path":"/dashboard?module=soil-health"},{"id":"support","label":"Support","path":"/dashboard/support"},{"id":"settings","label":"Settings","path":"/dashboard/settings"}]'::jsonb,
      'Agronomy and crop optimization'
    )
  ON CONFLICT (role_name) DO UPDATE
  SET
    display_name = EXCLUDED.display_name,
    landing_page = EXCLUDED.landing_page,
    menu_items = EXCLUDED.menu_items,
    description = EXCLUDED.description,
    updated_at = NOW();

  -- ---------------------------------------------------------------------------
  -- Profiles + memberships (only if users exist).
  -- ---------------------------------------------------------------------------
  IF v_users_count > 0 AND v_org_count > 0 THEN
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      full_name,
      locale,
      preferred_locale,
      notification_preferences,
      notifications_email,
      notifications_inapp,
      notifications_critical_only
    )
    SELECT
      u.id,
      u.email,
      'Demo',
      'User ' || u.user_rank,
      'Demo User ' || u.user_rank,
      CASE WHEN u.user_rank % 3 = 0 THEN 'ar' ELSE 'en' END,
      CASE WHEN u.user_rank % 3 = 0 THEN 'ar' ELSE 'en' END,
      jsonb_build_object(
        'email', (u.user_rank % 5) <> 0,
        'inApp', TRUE,
        'criticalOnly', (u.user_rank % 4) = 0
      ),
      (u.user_rank % 5) <> 0,
      TRUE,
      (u.user_rank % 4) = 0
    FROM tmp_seed_users u
    ON CONFLICT (id) DO NOTHING;

    -- Primary assignment: one owner per seeded organization.
    INSERT INTO public.user_organization_members (
      user_id,
      organization_id,
      role,
      status,
      invited_at,
      joined_at
    )
    SELECT
      u.id,
      o.id,
      'owner',
      'active',
      NOW() - ((o.org_rank + u.user_rank) * INTERVAL '3 days'),
      NOW() - ((o.org_rank + u.user_rank) * INTERVAL '2 days')
    FROM tmp_org_map o
    JOIN tmp_seed_users u
      ON u.user_rank = ((o.org_rank - 1) % v_users_count) + 1
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- Broader multi-role membership matrix.
    INSERT INTO public.user_organization_members (
      user_id,
      organization_id,
      role,
      status,
      invited_at,
      joined_at
    )
    SELECT
      u.id,
      o.id,
      CASE ((u.user_rank + o.org_rank) % 11)
        WHEN 0 THEN 'admin'
        WHEN 1 THEN 'member'
        WHEN 2 THEN 'viewer'
        WHEN 3 THEN 'editor'
        WHEN 4 THEN 'operator'
        WHEN 5 THEN 'ministry_officer'
        WHEN 6 THEN 'sourcing_manager'
        WHEN 7 THEN 'supply_chain_officer'
        WHEN 8 THEN 'finance_officer'
        WHEN 9 THEN 'credit_analyst'
        ELSE 'farm_manager'
      END,
      CASE WHEN (u.user_rank + o.org_rank) % 7 = 0 THEN 'invited' ELSE 'active' END,
      NOW() - ((u.user_rank + o.org_rank) * INTERVAL '5 days'),
      NOW() - ((u.user_rank + o.org_rank) * INTERVAL '4 days')
    FROM tmp_org_map o
    JOIN tmp_seed_users u ON ((u.user_rank + o.org_rank) % 3) = 0
    WHERE u.user_rank <= 50
    ON CONFLICT (user_id, organization_id) DO NOTHING;

    -- Ensure impersonation state rows exist but do not alter current user behavior.
    INSERT INTO public.user_impersonation_state (
      user_id,
      role_name,
      org_id,
      is_impersonating,
      updated_at
    )
    SELECT
      u.id,
      NULL,
      NULL,
      FALSE,
      NOW()
    FROM tmp_seed_users u
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Farms for farm_company organizations (requires at least one user).
  -- ---------------------------------------------------------------------------
  IF v_primary_user IS NOT NULL THEN
    INSERT INTO public.farms (
      organization_id,
      name_en,
      name_ar,
      location,
      type,
      size_hectares,
      status,
      created_by
    )
    SELECT
      o.id,
      INITCAP(REPLACE(o.slug, '-', ' ')) || ' Farm ' || g.farm_no,
      'مزرعة ' || g.farm_no || ' - ' || INITCAP(REPLACE(o.slug, '-', ' ')),
      CASE (g.farm_no % 6)
        WHEN 0 THEN 'Al Khor'
        WHEN 1 THEN 'Al Rayyan'
        WHEN 2 THEN 'Umm Salal'
        WHEN 3 THEN 'Al Daayen'
        WHEN 4 THEN 'Al Wakrah'
        ELSE 'Madinat ash Shamal'
      END,
      CASE ((g.farm_no + o.org_rank) % 3)
        WHEN 0 THEN 'crop'
        WHEN 1 THEN 'livestock'
        ELSE 'aquaculture'
      END,
      ROUND((20 + o.org_rank * 5 + g.farm_no * 2.5)::NUMERIC, 2),
      CASE ((g.farm_no + o.org_rank) % 5)
        WHEN 0 THEN 'maintenance'
        WHEN 1 THEN 'inactive'
        ELSE 'active'
      END,
      v_primary_user
    FROM tmp_org_map o
    CROSS JOIN generate_series(1, 18) AS g(farm_no)
    WHERE o.organization_type = 'farm_company'
      AND NOT EXISTS (
        SELECT 1
        FROM public.farms f
        WHERE f.organization_id = o.id
          AND f.name_en = INITCAP(REPLACE(o.slug, '-', ' ')) || ' Farm ' || g.farm_no
      );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Invite requests with multiple statuses (respects one-pending-per-user rule).
  -- ---------------------------------------------------------------------------
  IF v_users_count > 0 AND v_org_count > 1 THEN
    INSERT INTO public.organization_invite_requests (
      requester_user_id,
      requester_email,
      target_organization_id,
      requested_role,
      note,
      status
    )
    SELECT
      u.id,
      u.email,
      o.id,
      CASE ((u.user_rank + o.org_rank) % 4)
        WHEN 0 THEN 'member'
        WHEN 1 THEN 'admin'
        WHEN 2 THEN 'member'
        ELSE 'owner'
      END,
      'Historical request #' || u.user_rank || ' for ' || o.slug,
      CASE (u.user_rank % 3)
        WHEN 0 THEN 'approved'
        WHEN 1 THEN 'rejected'
        ELSE 'cancelled'
      END
    FROM tmp_seed_users u
    JOIN tmp_org_map o
      ON o.org_rank = ((u.user_rank + 1) % v_org_count) + 1
    WHERE u.user_rank <= 40
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_invite_requests r
        WHERE r.requester_user_id = u.id
          AND r.target_organization_id = o.id
          AND r.status = CASE (u.user_rank % 3)
            WHEN 0 THEN 'approved'
            WHEN 1 THEN 'rejected'
            ELSE 'cancelled'
          END
      )
    ON CONFLICT (requester_user_id, target_organization_id, status) DO NOTHING;

    -- Exactly one pending request per user (when none exists yet).
    INSERT INTO public.organization_invite_requests (
      requester_user_id,
      requester_email,
      target_organization_id,
      requested_role,
      note,
      status
    )
    SELECT
      u.id,
      u.email,
      o.id,
      'member',
      'Pending onboarding request for ' || o.slug,
      'pending'
    FROM tmp_seed_users u
    JOIN tmp_org_map o
      ON o.org_rank = ((u.user_rank + 3) % v_org_count) + 1
    WHERE u.user_rank <= 30
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_invite_requests p
        WHERE p.requester_user_id = u.id
          AND p.status = 'pending'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_invite_requests x
        WHERE x.requester_user_id = u.id
          AND x.target_organization_id = o.id
          AND x.status = 'pending'
      );

    -- If farm association column exists, connect pending requests to a farm_company farm.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organization_invite_requests'
        AND column_name = 'requested_farm_id'
    ) THEN
      UPDATE public.organization_invite_requests r
      SET requested_farm_id = farm_choice.id
      FROM public.organizations org
      JOIN LATERAL (
        SELECT f.id
        FROM public.farms f
        WHERE f.organization_id = org.id
        ORDER BY f.created_at, f.id
        LIMIT 1
      ) AS farm_choice ON TRUE
      WHERE r.target_organization_id = org.id
        AND r.status IN ('pending', 'approved')
        AND r.requested_farm_id IS NULL
        AND COALESCE(NULLIF(org.organization_type, ''), NULLIF(org.type, ''), 'private') = 'farm_company';
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Role delegations (cross-user governance samples).
  -- ---------------------------------------------------------------------------
  IF v_users_count > 1 AND v_org_count > 0 THEN
    INSERT INTO public.role_delegations (
      user_id,
      delegated_to_user_id,
      organization_id,
      delegated_role,
      delegation_reason,
      is_active,
      expires_at
    )
    SELECT
      u1.id,
      u2.id,
      o.id,
      CASE ((u1.user_rank + o.org_rank) % 5)
        WHEN 0 THEN 'admin'
        WHEN 1 THEN 'ministry_officer'
        WHEN 2 THEN 'sourcing_manager'
        WHEN 3 THEN 'credit_analyst'
        ELSE 'farm_manager'
      END,
      'Seed delegation for continuity planning',
      TRUE,
      NOW() + ((30 + (u1.user_rank % 20)) || ' days')::INTERVAL
    FROM tmp_seed_users u1
    JOIN tmp_seed_users u2
      ON u2.user_rank = ((u1.user_rank + 1) % v_users_count) + 1
    JOIN tmp_org_map o
      ON o.org_rank = ((u1.user_rank + 2) % v_org_count) + 1
    WHERE u1.user_rank <= 25
      AND u1.id <> u2.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.role_delegations d
        WHERE d.user_id = u1.id
          AND d.delegated_to_user_id = u2.id
          AND d.organization_id = o.id
          AND d.delegated_role = CASE ((u1.user_rank + o.org_rank) % 5)
            WHEN 0 THEN 'admin'
            WHEN 1 THEN 'ministry_officer'
            WHEN 2 THEN 'sourcing_manager'
            WHEN 3 THEN 'credit_analyst'
            ELSE 'farm_manager'
          END
      );
  END IF;

  -- ---------------------------------------------------------------------------
  -- Supply overview snapshots for recent 45 days on multiple organizations.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.supply_overview_snapshots (
    organization_id,
    snapshot_date,
    available_contract_volume_tons,
    available_contract_volume_delta_pct,
    in_transit_tons,
    in_transit_delta_pct,
    at_risk_deliveries_count,
    at_risk_deliveries_delta_count,
    avg_lead_time_days,
    avg_lead_time_delta_days
  )
  SELECT
    o.id,
    CURRENT_DATE - g.day_offset,
    ROUND((7800 + o.org_rank * 420 + (44 - g.day_offset) * 18)::NUMERIC, 2),
    ROUND((((o.org_rank % 6) - 2.5) * 1.2 + (g.day_offset % 5) * 0.25)::NUMERIC, 2),
    ROUND((900 + o.org_rank * 70 + (g.day_offset % 9) * 25)::NUMERIC, 2),
    ROUND((((g.day_offset % 7) - 3) * 0.55)::NUMERIC, 2),
    ((o.org_rank + g.day_offset) % 11) + 1,
    ((o.org_rank + g.day_offset + 2) % 5) - 2,
    ROUND((3.8 + (o.org_rank % 5) * 0.35 + (g.day_offset % 4) * 0.15)::NUMERIC, 2),
    ROUND((((g.day_offset % 6) - 2) * 0.12)::NUMERIC, 2)
  FROM tmp_org_map o
  CROSS JOIN generate_series(0, 44) AS g(day_offset)
  WHERE o.organization_type IN ('private', 'public', 'farm_company', 'government')
  ON CONFLICT (organization_id, snapshot_date) DO UPDATE
  SET
    available_contract_volume_tons = EXCLUDED.available_contract_volume_tons,
    available_contract_volume_delta_pct = EXCLUDED.available_contract_volume_delta_pct,
    in_transit_tons = EXCLUDED.in_transit_tons,
    in_transit_delta_pct = EXCLUDED.in_transit_delta_pct,
    at_risk_deliveries_count = EXCLUDED.at_risk_deliveries_count,
    at_risk_deliveries_delta_count = EXCLUDED.at_risk_deliveries_delta_count,
    avg_lead_time_days = EXCLUDED.avg_lead_time_days,
    avg_lead_time_delta_days = EXCLUDED.avg_lead_time_delta_days;

  -- Supply flows.
  INSERT INTO public.supply_flows (
    organization_id,
    flow_code,
    commodity,
    origin_label,
    destination_label,
    status,
    eta_label,
    priority,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    o.id,
    UPPER(REPLACE(SUBSTRING(o.slug, 1, 4), '-', '')) || '-' || LPAD((o.org_rank * 100 + t.seq)::TEXT, 4, '0'),
    t.commodity,
    t.origin_label,
    t.destination_label,
    t.status,
    t.eta_label,
    t.priority + (o.org_rank % 7),
    TRUE,
    NOW() - (t.seq * INTERVAL '6 hours'),
    NOW() - (t.seq * INTERVAL '2 hours')
  FROM tmp_org_map o
  JOIN (
    SELECT * FROM (VALUES
      (1, 'Fresh Tomatoes', 'Northern Farm Cluster', 'Doha Distribution Hub', 'on-track', 'Today 18:30', 10),
      (2, 'Cucumbers', 'Umm Salal Greenhouses', 'Retail North Corridor', 'watch', 'Today 22:10', 18),
      (3, 'Leafy Greens', 'Hydroponic Hub A', 'West Bay Retail Chain', 'risk', 'Delayed +7h', 24),
      (4, 'Poultry Feed', 'Industrial Feed Mill', 'Al Wakrah Poultry Network', 'watch', 'Tomorrow 07:20', 20),
      (5, 'Dairy Inputs', 'Cold Chain Depot 3', 'Central Processing Zone', 'on-track', 'Tomorrow 09:15', 16),
      (6, 'Barley Grain', 'Import Berth 2', 'National Storage Silo', 'risk', 'Awaiting customs', 28),
      (7, 'Fertilizer Mix', 'Doha Agro Terminal', 'Regional Farm Cooperatives', 'on-track', 'Today 16:10', 14),
      (8, 'Potatoes', 'Domestic Field Network', 'Wholesale Market Authority', 'watch', 'Tomorrow 12:40', 22),
      (9, 'Onions', 'Southern Packing Station', 'Hypermarket Chain East', 'on-track', 'Today 21:00', 19),
      (10, 'Rice Imports', 'Marine Port South', 'Strategic Reserve Unit', 'risk', 'Delayed +14h', 30),
      (11, 'Frozen Poultry', 'Protein Cold Plant', 'Food Service Segment', 'watch', 'Tomorrow 03:30', 23),
      (12, 'Palm Oil', 'Bulk Liquid Terminal', 'Food Manufacturing Belt', 'on-track', 'Today 23:45', 17)
    ) AS flow_templates(seq, commodity, origin_label, destination_label, status, eta_label, priority)
  ) t ON TRUE
  WHERE o.organization_type IN ('private', 'public', 'farm_company', 'government')
    AND NOT EXISTS (
      SELECT 1
      FROM public.supply_flows f
      WHERE f.organization_id = o.id
        AND f.flow_code = UPPER(REPLACE(SUBSTRING(o.slug, 1, 4), '-', '')) || '-' || LPAD((o.org_rank * 100 + t.seq)::TEXT, 4, '0')
    );

  -- Action queues.
  INSERT INTO public.supply_action_queue (
    organization_id,
    action_text,
    priority,
    is_open,
    created_at,
    updated_at
  )
  SELECT
    o.id,
    t.action_text || ' [' || o.slug || ']',
    t.priority + (o.org_rank % 5),
    TRUE,
    NOW() - (t.seq * INTERVAL '3 hours'),
    NOW() - (t.seq * INTERVAL '75 minutes')
  FROM tmp_org_map o
  JOIN (
    SELECT * FROM (VALUES
      (1, 'Validate delayed greenhouse corridor dispatches', 10),
      (2, 'Re-route poultry feed lots to south corridor', 12),
      (3, 'Confirm customs slot for imported grain shipment', 14),
      (4, 'Escalate supplier SLA variance for top 3 vendors', 16),
      (5, 'Review cold chain buffer for weekend demand spike', 18),
      (6, 'Approve emergency purchase request for spare stock', 20),
      (7, 'Align trucking windows with municipal access permits', 22),
      (8, 'Publish updated ETA bulletin to partner dashboard', 24)
    ) AS queue_templates(seq, action_text, priority)
  ) t ON TRUE
  WHERE o.organization_type IN ('private', 'public', 'farm_company', 'government')
    AND NOT EXISTS (
      SELECT 1
      FROM public.supply_action_queue q
      WHERE q.organization_id = o.id
        AND q.action_text = t.action_text || ' [' || o.slug || ']'
    );

  -- ---------------------------------------------------------------------------
  -- Seeded audit event history with deterministic resource ids.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.audit_logs (
    user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    changes,
    created_at
  )
  SELECT
    u.id,
    o.id,
    CASE (g.seq % 6)
      WHEN 0 THEN 'member.assigned'
      WHEN 1 THEN 'invite.requested'
      WHEN 2 THEN 'supply.snapshot.refreshed'
      WHEN 3 THEN 'farm.status.updated'
      WHEN 4 THEN 'policy.reviewed'
      ELSE 'delegation.created'
    END,
    CASE (g.seq % 5)
      WHEN 0 THEN 'organization'
      WHEN 1 THEN 'membership'
      WHEN 2 THEN 'supply_flow'
      WHEN 3 THEN 'farm'
      ELSE 'access_policy'
    END,
    'seed-event-' || LPAD(g.seq::TEXT, 4, '0'),
    jsonb_build_object(
      'seed_batch', '00020',
      'sequence', g.seq,
      'impact_level', CASE WHEN g.seq % 9 = 0 THEN 'high' WHEN g.seq % 3 = 0 THEN 'medium' ELSE 'low' END
    ),
    NOW() - (g.seq * INTERVAL '90 minutes')
  FROM generate_series(1, 420) AS g(seq)
  JOIN tmp_org_map o
    ON o.org_rank = ((g.seq - 1) % v_org_count) + 1
  LEFT JOIN tmp_seed_users u
    ON u.user_rank = ((g.seq - 1) % GREATEST(v_users_count, 1)) + 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.audit_logs a
    WHERE a.resource_type = CASE (g.seq % 5)
      WHEN 0 THEN 'organization'
      WHEN 1 THEN 'membership'
      WHEN 2 THEN 'supply_flow'
      WHEN 3 THEN 'farm'
      ELSE 'access_policy'
    END
      AND a.resource_id = 'seed-event-' || LPAD(g.seq::TEXT, 4, '0')
  );
END
$$;
