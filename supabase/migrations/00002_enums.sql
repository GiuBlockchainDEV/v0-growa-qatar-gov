-- Growa Qatar - Enum Types
-- Step 1.8: Define enum types for auth/access domain

-- Organization types
CREATE TYPE organization_type AS ENUM (
  'ministry',
  'sovereign_entity',
  'state_operator',
  'financial_institution',
  'research_entity',
  'external_operator'
);

-- Membership status
CREATE TYPE membership_status AS ENUM (
  'active',
  'pending',
  'suspended',
  'revoked'
);

-- Invitation status
CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

-- Audit actions
CREATE TYPE audit_action AS ENUM (
  -- Auth actions
  'sign_in',
  'sign_out',
  'password_reset',
  'mfa_enabled',
  'mfa_disabled',
  
  -- User management
  'user_invited',
  'user_activated',
  'user_suspended',
  'user_revoked',
  'role_changed',
  'scope_changed',
  
  -- Organization actions
  'org_created',
  'org_updated',
  'dept_created',
  'dept_updated',
  
  -- Data access
  'data_exported',
  'report_generated',
  
  -- Operational actions
  'alert_acknowledged',
  'alert_resolved',
  'inspection_completed',
  'approval_granted',
  'approval_denied'
);
