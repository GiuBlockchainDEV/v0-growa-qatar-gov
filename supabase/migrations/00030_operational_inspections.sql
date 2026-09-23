-- Field inspection workflow v1

CREATE TABLE IF NOT EXISTS operational_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES farms(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'assigned' CHECK (
    status IN (
      'assigned',
      'preparing',
      'on_site',
      'evidence',
      'findings',
      'verification',
      'closed'
    )
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  scheduled_at timestamptz,
  due_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id),
  source_investigation_id uuid,
  findings text,
  evidence_notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_operational_inspections_org_status
  ON operational_inspections (organization_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_operational_inspections_farm
  ON operational_inspections (farm_id);

ALTER TABLE operational_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_inspections_select ON operational_inspections
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY operational_inspections_insert ON operational_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY operational_inspections_update ON operational_inspections
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_members WHERE user_id = auth.uid()
    )
  );
