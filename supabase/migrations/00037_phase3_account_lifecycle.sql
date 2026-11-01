-- Phase 3: invitation-only onboarding, account lifecycle, security audit helpers.

-- Account lifecycle on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('invited', 'active', 'suspended', 'deactivated'));
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_scope TEXT;

-- Organization invitations (token stored as hash only)
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  department_scope TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  token_hash TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  membership_id UUID REFERENCES public.user_organization_members(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  CONSTRAINT organization_invitations_email_lower CHECK (email = lower(trim(email)))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_pending_email_org
  ON public.organization_invitations (organization_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_invitations_token_hash
  ON public.organization_invitations (token_hash)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_status
  ON public.organization_invitations (organization_id, status);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_invitations_admin_select ON public.organization_invitations;
CREATE POLICY org_invitations_admin_select
  ON public.organization_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = organization_invitations.organization_id
        AND COALESCE(m.status, 'active') = 'active'
        AND lower(m.role) IN (
          'owner', 'admin', 'super_admin', 'ministry_admin', 'ministry_super_admin',
          'hassad_admin', 'qdb_admin', 'farm_company_admin'
        )
    )
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS org_invitations_deny_mutations ON public.organization_invitations;
CREATE POLICY org_invitations_deny_mutations
  ON public.organization_invitations
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Append-only audit helper (service role / definer from app server)
CREATE OR REPLACE FUNCTION public.append_security_audit(
  p_actor_id UUID,
  p_organization_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    organization_id,
    action,
    resource_type,
    resource_id,
    changes,
    created_at
  )
  VALUES (
    p_actor_id,
    p_organization_id,
    p_action,
    p_resource_type,
    p_resource_id::TEXT,
    p_metadata,
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_security_audit(UUID, UUID, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_security_audit(UUID, UUID, TEXT, TEXT, UUID, JSONB) TO service_role;
