-- Repair: 00032 cannot CREATE OR REPLACE when OUT/return row type changes (00031 → 00032).
DROP FUNCTION IF EXISTS public.get_my_auth_capabilities();

CREATE OR REPLACE FUNCTION public.get_my_auth_capabilities()
RETURNS TABLE (
  is_platform_admin BOOLEAN,
  platform_staff_tier TEXT,
  role_preview_active BOOLEAN,
  preview_role TEXT,
  preview_org_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_preview RECORD;
  v_tier TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT s.role_name, s.org_id, s.is_impersonating
  INTO v_preview
  FROM public.user_impersonation_state s
  WHERE s.user_id = v_uid
  LIMIT 1;

  SELECT pa.staff_tier INTO v_tier
  FROM public.platform_admins pa
  WHERE pa.user_id = v_uid
  LIMIT 1;

  RETURN QUERY
  SELECT
    public.is_platform_admin(v_uid),
    COALESCE(v_tier, CASE WHEN public.is_platform_admin(v_uid) THEN 'super_admin' ELSE NULL END),
    COALESCE(v_preview.is_impersonating, FALSE) AND public.is_platform_admin(v_uid),
    CASE WHEN COALESCE(v_preview.is_impersonating, FALSE) THEN v_preview.role_name ELSE NULL END,
    CASE WHEN COALESCE(v_preview.is_impersonating, FALSE) THEN v_preview.org_id ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_auth_capabilities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_auth_capabilities() TO authenticated;
