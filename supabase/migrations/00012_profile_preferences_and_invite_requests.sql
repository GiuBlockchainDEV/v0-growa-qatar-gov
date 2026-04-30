-- Persist user preferences and organization invite requests

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "inApp": true, "criticalOnly": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS notifications_email BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifications_inapp BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifications_critical_only BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.organization_invite_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email TEXT NOT NULL,
  target_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL DEFAULT 'member' CHECK (requested_role IN ('owner', 'admin', 'member')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (requester_user_id, target_organization_id, status)
);

CREATE INDEX IF NOT EXISTS org_invite_requests_org_idx
  ON public.organization_invite_requests(target_organization_id);

CREATE INDEX IF NOT EXISTS org_invite_requests_requester_idx
  ON public.organization_invite_requests(requester_user_id);

ALTER TABLE public.organization_invite_requests ENABLE ROW LEVEL SECURITY;

-- Requesters can see their own requests.
CREATE POLICY "org_invite_requests_select_own"
  ON public.organization_invite_requests
  FOR SELECT
  USING (auth.uid() = requester_user_id);

-- Org owners/admins can see requests for their organizations.
CREATE POLICY "org_invite_requests_select_org_admin"
  ON public.organization_invite_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = organization_invite_requests.target_organization_id
        AND m.role IN ('owner', 'admin')
    )
  );

-- Authenticated users can create requests only for themselves.
CREATE POLICY "org_invite_requests_insert_own"
  ON public.organization_invite_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = requester_user_id
  );

-- Requester can update/cancel their pending requests.
CREATE POLICY "org_invite_requests_update_own_pending"
  ON public.organization_invite_requests
  FOR UPDATE
  USING (auth.uid() = requester_user_id AND status = 'pending')
  WITH CHECK (auth.uid() = requester_user_id);

-- Org owners/admins can update request status (approve/reject).
CREATE POLICY "org_invite_requests_update_org_admin"
  ON public.organization_invite_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = organization_invite_requests.target_organization_id
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_organization_members m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = organization_invite_requests.target_organization_id
        AND m.role IN ('owner', 'admin')
    )
  );
