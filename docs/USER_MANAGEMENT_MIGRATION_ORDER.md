# User management — Supabase migration order (hosted)

Apply in the SQL editor in this order:

| Step | File | Purpose |
|------|------|---------|
| 1 | `00031_user_management_security_hardening.sql` | Phase 1: platform admins, membership RPCs, org creation, RLS |
| 2 | `00032_unified_identity_authorization.sql` | Phase 2: staff_tier, legacy backfill, **5-column** `get_my_auth_capabilities` |
| 3 | `00034_role_definitions_safe_rebuild.sql` | Legacy-safe `role_definitions` |
| 4 | `00035_fix_get_my_auth_capabilities_signature.sql` | Optional repair if you applied an old 00031/00032 out of order |
| 5 | `00037_phase3_account_lifecycle.sql` | Phase 3 invitations & account status |
| 6 | `00038_organizations_is_active.sql` | Phase 4 org activate/deactivate flag |

Skip `00033` (no-op placeholder).

## 00031 fails with 42P13 on `get_my_auth_capabilities` but 00032 is OK

You still have an **old** `00031` script (four-column `CREATE OR REPLACE` on that RPC). The database already has the **five-column** function from 00032/00035.

1. **Do not** re-run old 00031.
2. Run **`00036_phase1_completion_skip_auth_caps.sql`** — applies the rest of Phase 1 (trigger, org RPC, RLS) without touching auth capabilities.
3. For new environments, use **00031 R2** from `main` (search the file: there must be **no** `CREATE OR REPLACE FUNCTION public.get_my_auth_capabilities`).

## If you already ran 00034 and 00035

1. Pull **latest** `00031` (R2) and `00032` from `main`.
2. Run **full** `00031` only if the file has **no** `CREATE` for `get_my_auth_capabilities`; otherwise use **00036** after 00032.
3. Run **full** `00032` if not already applied.
4. Re-run `00035` only if `get_my_auth_capabilities` is still missing or wrong.

Verify:

```sql
SELECT proname, pg_get_function_result(oid)
FROM pg_proc
WHERE proname = 'get_my_auth_capabilities';
```

Expected result type includes `platform_staff_tier`.

## Bootstrap (once)

Service role / SQL editor **without** end-user JWT:

```sql
SELECT public.bootstrap_first_platform_admin('<auth.users uuid>'::uuid);
```
