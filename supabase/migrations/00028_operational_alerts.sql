-- Operational alerts lifecycle for Watchtower signal → alert workflow

CREATE TABLE IF NOT EXISTS operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  source_signal_id text,
  title text NOT NULL,
  summary text,
  severity text NOT NULL CHECK (severity IN ('info', 'attention', 'high', 'critical')),
  status text NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'acknowledged', 'investigating', 'action_required', 'monitoring', 'resolved', 'dismissed')
  ),
  alert_type text,
  affected_farm_ids uuid[] DEFAULT '{}',
  affected_parcel_ids text[] DEFAULT '{}',
  affected_point_ids uuid[] DEFAULT '{}',
  owner_user_id uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_operational_alerts_org_status
  ON operational_alerts (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_operational_alerts_source_signal
  ON operational_alerts (source_signal_id);

ALTER TABLE operational_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_alerts_select ON operational_alerts
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY operational_alerts_insert ON operational_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY operational_alerts_update ON operational_alerts
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );
