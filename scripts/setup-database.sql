-- Growa Qatar Database Setup
-- Run this script in your Supabase SQL Editor

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select" ON public.organizations
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS organizations_slug_idx ON public.organizations(slug);

-- 2. Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', null),
    coalesce(new.raw_user_meta_data ->> 'last_name', null)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Create user_organization_members table
CREATE TABLE IF NOT EXISTS public.user_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.user_organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_org_members_select_own" ON public.user_organization_members
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_org_members_insert" ON public.user_organization_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_org_members_user_idx ON public.user_organization_members(user_id);
CREATE INDEX IF NOT EXISTS user_org_members_org_idx ON public.user_organization_members(organization_id);

-- 4. Create farms table
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'crop' CHECK (type IN ('crop', 'livestock', 'aquaculture')),
  size_hectares DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- Users can view farms from their organizations
CREATE POLICY "farms_select" ON public.farms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_members
      WHERE user_id = auth.uid()
      AND organization_id = farms.organization_id
    )
  );

-- Users can insert farms to their organizations
CREATE POLICY "farms_insert" ON public.farms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organization_members
      WHERE user_id = auth.uid()
      AND organization_id = farms.organization_id
    )
  );

CREATE INDEX IF NOT EXISTS farms_org_idx ON public.farms(organization_id);

-- 5. Insert sample organization for Qatar
INSERT INTO public.organizations (name, slug, description)
VALUES ('Ministry of Municipality', 'ministry-municipality', 'Qatar Ministry of Municipality and Environment')
ON CONFLICT (slug) DO NOTHING;

-- Done!
SELECT 'Database setup complete!' as status;
