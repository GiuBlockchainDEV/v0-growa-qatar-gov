-- Growa Qatar - Invitations Table
-- Step 2.5: Invitation acceptance flow

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Invitation metadata
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_template_id UUID NOT NULL REFERENCES role_templates(id),
  department_id UUID REFERENCES departments(id),
  region_id UUID REFERENCES regions(id),
  
  -- Invitation state
  status TEXT NOT NULL DEFAULT 'pending'::TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Lifecycle
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  CONSTRAINT invitation_not_accepted_or_expired CHECK (
    (status = 'pending' AND accepted_at IS NULL AND accepted_by_user_id IS NULL)
    OR (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
    OR (status IN ('expired', 'revoked') AND accepted_at IS NULL AND accepted_by_user_id IS NULL)
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view pending invitations for their email
CREATE POLICY "Invitations visible to recipient email" ON invitations
  FOR SELECT USING (
    email = auth.jwt() ->> 'email'
    OR EXISTS (
      SELECT 1 FROM memberships m
      JOIN profiles p ON m.user_id = p.id
      WHERE m.organization_id = invitations.organization_id
      AND p.id = auth.uid()
      AND m.role_template_id IN (
        SELECT id FROM role_templates
        WHERE (
          rt.role_name = 'Org Master Admin' OR rt.role_name = 'Org Admin'
        )
      )
    )
  );

-- Only organization admins can create invitations
CREATE POLICY "Invitations created by org admins" ON invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
      AND m.organization_id = invitations.organization_id
      AND rt.role_name IN ('Org Master Admin', 'Org Admin')
    )
  );

-- Only organization admins can update/revoke invitations
CREATE POLICY "Invitations updated by org admins" ON invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
      AND m.organization_id = invitations.organization_id
      AND rt.role_name IN ('Org Master Admin', 'Org Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN role_templates rt ON m.role_template_id = rt.id
      WHERE m.user_id = auth.uid()
      AND m.organization_id = invitations.organization_id
      AND rt.role_name IN ('Org Master Admin', 'Org Admin')
    )
  );

-- Audit log trigger for invitations
CREATE TRIGGER audit_invitations_changes
  AFTER INSERT OR UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();
