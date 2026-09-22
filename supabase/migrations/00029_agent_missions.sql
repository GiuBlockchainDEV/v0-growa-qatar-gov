-- Agentic AI mission persistence (Mission Control)

CREATE TABLE IF NOT EXISTS agent_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  task_type text NOT NULL DEFAULT 'investigation',
  objective text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'running', 'waiting_for_agent', 'waiting_for_human', 'completed', 'failed')
  ),
  assigned_agent text NOT NULL DEFAULT 'orchestrator',
  agents_involved text[] DEFAULT '{}',
  context jsonb DEFAULT '{}'::jsonb,
  inputs jsonb DEFAULT '[]'::jsonb,
  outputs jsonb DEFAULT '[]'::jsonb,
  proposed_actions jsonb DEFAULT '[]'::jsonb,
  events jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_missions_org_status
  ON agent_missions (organization_id, status, created_at DESC);

ALTER TABLE agent_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_missions_select ON agent_missions
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY agent_missions_insert ON agent_missions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
    AND requested_by = auth.uid()
  );

CREATE POLICY agent_missions_update ON agent_missions
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

-- Investigations (risk workflow v1)

CREATE TABLE IF NOT EXISTS operational_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_progress', 'pending_review', 'resolved', 'closed')
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  source_signal_id text,
  source_alert_id uuid,
  affected_farm_ids uuid[] DEFAULT '{}',
  owner_user_id uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_operational_investigations_org
  ON operational_investigations (organization_id, status);

ALTER TABLE operational_investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_investigations_select ON operational_investigations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY operational_investigations_insert ON operational_investigations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY operational_investigations_update ON operational_investigations
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );
