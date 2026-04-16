-- Remove legacy recursive policies from user_organization_members and
-- replace with helper-function based policies.

CREATE OR REPLACE FUNCTION public.current_user_in_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = p_org_id
      AND COALESCE(m.status, 'active') <> 'inactive'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_members m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = p_org_id
      AND COALESCE(m.status, 'active') <> 'inactive'
      AND m.role IN (
        'owner', 'admin', 'super_admin',
        'ministry_admin', 'ministry_super_admin',
        'hassad_admin', 'qdb_admin', 'farm_company_admin'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_in_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_org_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_in_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_org_admin(UUID) TO authenticated;

DROP POLICY IF EXISTS "user_org_members_select" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_insert" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_update" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_delete" ON public.user_organization_members;
DROP POLICY IF EXISTS "user_org_members_write_admins" ON public.user_organization_members;

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
  WITH CHECK (public.current_user_is_org_admin(organization_id));

CREATE POLICY "user_org_members_update"
  ON public.user_organization_members
  FOR UPDATE
  USING (public.current_user_is_org_admin(organization_id))
  WITH CHECK (public.current_user_is_org_admin(organization_id));

CREATE POLICY "user_org_members_delete"
  ON public.user_organization_members
  FOR DELETE
  USING (public.current_user_is_org_admin(organization_id));
