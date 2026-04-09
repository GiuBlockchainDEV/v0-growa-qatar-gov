-- Create user_organization_members table for multi-tenancy
CREATE TABLE public.user_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.user_organization_members ENABLE ROW LEVEL SECURITY;

-- Policies for user_organization_members
CREATE POLICY "user_org_members_select" ON public.user_organization_members FOR SELECT
  USING (auth.uid() = user_id OR 
         EXISTS (
           SELECT 1 FROM public.user_organization_members
           WHERE user_id = auth.uid()
           AND organization_id = user_organization_members.organization_id
         ));

CREATE POLICY "user_org_members_insert" ON public.user_organization_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE user_id = auth.uid()
    AND organization_id = user_organization_members.organization_id
    AND role IN ('owner', 'admin')
  ));

CREATE POLICY "user_org_members_delete" ON public.user_organization_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE user_id = auth.uid()
    AND organization_id = user_organization_members.organization_id
    AND role IN ('owner', 'admin')
  ));

-- Create indexes
CREATE INDEX user_org_members_user_id_idx ON public.user_organization_members(user_id);
CREATE INDEX user_org_members_organization_id_idx ON public.user_organization_members(organization_id);
