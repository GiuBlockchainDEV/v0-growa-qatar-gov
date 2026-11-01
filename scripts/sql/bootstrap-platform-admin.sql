-- One-time bootstrap for the first GROWA platform administrator.
-- Run ONLY in a controlled environment (local Supabase or approved maintenance window).
-- Requires service role / postgres session WITHOUT an end-user JWT.
--
-- 1. Confirm the auth.users UUID (Supabase Dashboard → Authentication → Users).
-- 2. Replace the placeholder below.
-- 3. Execute via Supabase SQL editor using service role, or:
--    supabase db execute --file scripts/sql/bootstrap-platform-admin.sql
--
-- SELECT id, email FROM auth.users WHERE email = 'verified-user@example.com';

SELECT public.bootstrap_first_platform_admin('00000000-0000-0000-0000-000000000001'::uuid);
