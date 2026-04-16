-- Fix infinite recursion in user_organization_members RLS policies.
-- The old SELECT policy queried user_organization_members inside itself,
-- which can recursively re-trigger policy evaluation.

CREATE OR REPLACE FUNCTION public.current_user_in_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_organization_members m
    WHERE m.user_id = v_uid
      AND m.organization_id = p_org_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_organization_members m
    WHERE m.user_id = v_uid
      AND m.organization_id = p_org_id
      AND m.role IN ('owner', 'admin')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_in_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_org_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_in_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_org_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "user_org_members_select" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_insert" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_update" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_delete" ON public.user_organization_members;

CREATE POLICY "user_org_members_select"
  ON public.user_organization_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.current_user_in_organization(organization_id)
  );

CREATE POLICY "user_org_members_insert"
  ON public.user_organization_members
  FOR INSERT
  WITH CHECK (
    public.current_user_is_org_admin(organization_id)
  );

CREATE POLICY "user_org_members_update"
  ON public.user_organization_members
  FOR UPDATE
  USING (
    public.current_user_is_org_admin(organization_id)
  )
  WITH CHECK (
    public.current_user_is_org_admin(organization_id)
  );

CREATE POLICY "user_org_members_delete"
  ON public.user_organization_members
  FOR DELETE
  USING (
    public.current_user_is_org_admin(organization_id)
  );
