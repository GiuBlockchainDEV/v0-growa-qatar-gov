# User Management — Migration & Rollback Plan

**Migration:** `supabase/migrations/00031_user_management_security_hardening.sql`  
**Phase:** 1 — security and authorization hardening  
**Applies to:** Existing NFII Supabase projects with legacy + unified schema

---

## 1. Objectives

- Close privilege escalation paths without deleting users or operational data.
- Introduce explicit **platform administrator** allowlist.
- Separate **role preview** (UI) from **membership authorization** (RLS/RPC).

---

## 2. Pre-flight checklist

- [ ] Backup database (Supabase dashboard or `pg_dump`).
- [ ] Record current row counts: `auth.users`, `profiles`, `organizations`, `user_organization_members`.
- [ ] Identify production UUID for bootstrap admin (do not guess from email).
- [ ] Confirm no pending duplicate `00031` on target (apply once).
- [ ] Schedule maintenance window if bootstrap runs on production (user approval required).

---

## 3. Apply order

1. **Staging / local Supabase** — apply migration; run bootstrap; smoke-test (login, org create, team page, supply overview).
2. **Production** — only after explicit authorization and staging sign-off.

```bash
# Local example (when Supabase CLI linked)
supabase db push
# Or run SQL file in SQL editor
```

---

## 4. Bootstrap (one-time)

After migration:

```sql
-- Service role session, no user JWT
SELECT public.bootstrap_first_platform_admin('<verified-auth-users-uuid>'::uuid);
```

Optional template: `scripts/sql/bootstrap-platform-admin.sql` (replace placeholder UUID).

Grant additional admins (as authenticated platform admin):

```sql
SELECT public.grant_platform_admin('<another-user-uuid>'::uuid);
```

---

## 5. Compatibility

| Area | Behavior after migration |
|------|---------------------------|
| Existing memberships | Unchanged rows; trigger enforces new rules on **updates** |
| `@growa.ai` users | No automatic powers; must be in `platform_admins` |
| Role preview | Disabled until platform admin bootstrap; stale preview cleared |
| `create_organization_with_owner` | Government types rejected for normal users |
| Farms API | RLS-only search (may return fewer rows for cross-tenant queries) |
| Clients without new RPC | `get_my_auth_capabilities` fails softly → treat as non-admin |

---

## 6. Rollback strategy

**Do not drop tables in rollback.** Prefer forward fix.

### Option A — Forward fix (preferred)

- Adjust policies/functions in a new migration `00032_*` if a regression is found.

### Option B — Revert functions (partial rollback)

Re-run prior definitions from `00017_unified_app_core_schema.sql` for:

- `get_effective_role`
- `set_impersonation` / `clear_impersonation`
- `create_organization_with_owner`
- `can_user_access` / `get_user_visibility`

And restore supply policies from `00016_update_supply_rls_for_impersonation.sql`.

**Note:** Reverting re-opens known vulnerabilities; use only in emergency.

### Option C — Platform admin table

`platform_admins` can remain; empty table restores “no platform admins” behavior.

---

## 7. Verification script (manual)

After apply + bootstrap:

1. **Unauthorized org create** — non-admin RPC with `government_master` → error.
2. **Self-service org** — private/farm_company → success.
3. **Self-promotion** — admin attempts to set own role to `ministry_admin` → error.
4. **Last owner** — single owner demotion/removal → error.
5. **Preview** — non-admin `set_impersonation` → error; admin → success; supply data still requires membership.
6. **Farms API** — authenticated user sees only RLS-visible farms.

---

## 8. Application deploy

Deploy app **after** migration (or same release window):

- Depends on `get_my_auth_capabilities`, hardened RPC behavior, farms route without service role.

Environment:

- Do **not** rely on `SUPABASE_SERVICE_ROLE_KEY` for user-facing farm list/search.

---

## 9. Phase 2+ (out of scope)

- Consolidate `memberships` → `user_organization_members`
- Server-side team APIs wrapping membership mutations
- Audit log writes on admin actions
- Platform admin UI for bootstrap/grant (instead of SQL)

---

*Prepared for Phase 1 — stop after security hardening per program directive.*
