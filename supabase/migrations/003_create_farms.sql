-- Create farms table
CREATE TABLE public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  location TEXT,
  type TEXT CHECK (type IN ('crop', 'livestock', 'aquaculture')),
  size_hectares DECIMAL(10, 2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

-- Policies for farms - users can only access farms from their organizations
CREATE POLICY "farms_select" ON public.farms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE user_id = auth.uid()
    AND organization_id = farms.organization_id
  ));

CREATE POLICY "farms_insert" ON public.farms FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE user_id = auth.uid()
    AND organization_id = farms.organization_id
  ));

CREATE POLICY "farms_update" ON public.farms FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE user_id = auth.uid()
    AND organization_id = farms.organization_id
  ));

CREATE POLICY "farms_delete" ON public.farms FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_organization_members
    WHERE user_id = auth.uid()
    AND organization_id = farms.organization_id
  ));

-- Create indexes
CREATE INDEX farms_organization_id_idx ON public.farms(organization_id);
CREATE INDEX farms_created_by_idx ON public.farms(created_by);
