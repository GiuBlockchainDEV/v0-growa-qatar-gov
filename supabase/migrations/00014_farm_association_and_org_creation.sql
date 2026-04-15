-- Add farm-level association support and self-service organization creation.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'private'
  CHECK (organization_type IN ('government_master', 'government', 'farm_company', 'public', 'private'));

ALTER TABLE public.organization_invite_requests
  ADD COLUMN IF NOT EXISTS requested_farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS org_invite_requests_requested_farm_idx
  ON public.organization_invite_requests(requested_farm_id);

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  org_description TEXT DEFAULT NULL,
  org_type TEXT DEFAULT 'private'
)
RETURNS TABLE (organization_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_slug TEXT;
  v_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := trim(coalesce(org_name, ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  v_slug := lower(trim(coalesce(org_slug, '')));
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Organization slug is required';
  END IF;

  IF org_type NOT IN ('government_master', 'government', 'farm_company', 'public', 'private') THEN
    RAISE EXCEPTION 'Invalid organization type';
  END IF;

  INSERT INTO public.organizations (
    name,
    slug,
    description,
    organization_type
  )
  VALUES (
    v_name,
    v_slug,
    NULLIF(trim(coalesce(org_description, '')), ''),
    org_type
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.user_organization_members (
    user_id,
    organization_id,
    role
  )
  VALUES (
    v_user_id,
    v_org_id,
    'owner'
  )
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET role = 'owner';

  RETURN QUERY SELECT v_org_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Organization slug already exists';
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(TEXT, TEXT, TEXT, TEXT) TO authenticated;
