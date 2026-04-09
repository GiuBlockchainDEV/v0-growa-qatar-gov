-- Create organizations table for multi-tenancy
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create policies - anyone can read organizations they're a member of
-- (we'll verify membership via user_organization_members table)
CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT
  USING (true);

-- Create index on slug for fast lookups
CREATE INDEX organizations_slug_idx ON public.organizations(slug);
