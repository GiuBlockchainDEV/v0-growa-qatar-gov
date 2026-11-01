# User Management — Security Audit

**Date:** 31 October 2026 (Asia/Qatar)  
**Scope:** Phase 1 — security and authorization hardening (audit + fixes)  
**Source of truth:** Code and `supabase/migrations/` (documentation may lag)

---

## 1. System map

| Layer | Implementation | Notes |
|-------|----------------|-------|
| Authentication | Supabase Auth, `@supabase/ssr` in `lib/supabase/server.ts` / client | Session via cookies; no service role in user-facing server client |
| Profiles | `public.profiles` (+ legacy `002_create_profiles.sql`) | RLS; trigger `handle_new_user` on signup |
| Organizations | `public.organizations` | Unified columns `type` / `organization_type` synced by trigger |
| Active membership | `public.user_organization_members` | Primary tenancy model; extended role enum |
| Legacy membership | `public.memberships` + `role_templates` | Still referenced in RLS helpers and `can_user_access` fallback |
| Navigation metadata | `public.role_navigation` | Read-only for authenticated users |
| Invites | `public.invitations` (legacy), `public.organization_invite_requests` | Self-service join requests with RLS |
| Delegations | `public.role_delegations` | Read own/delegatee only; no write policies in migrations |
| Role preview (legacy name: impersonation) | `public.user_impersonation_state` + RPCs | Was tied to `@growa.ai` email |
| RLS helpers | `current_user_in_organization`, `current_user_is_org_admin`, legacy `memberships` helpers | SECURITY DEFINER |
| App authorization | `hooks/use-permissions.ts`, `hooks/use-data-access.ts`, API route session checks | Client-side helpers are **not** security boundaries |

---

## 2. Critical findings (pre-hardening)

### A. `create_organization_with_owner()`

- **Issue:** Any authenticated user could pass `org_type` of `government` or `government_master` and become `owner`.
- **Fix (00031):** Reject privileged types unless `is_platform_admin(auth.uid())`.

### B. `set_impersonation()` / `user_impersonation_state`

- **Issue:** `@growa.ai` email suffix granted preview/impersonation; direct RLS `FOR ALL` allowed users to write their own row; supply RLS and `can_user_access` treated preview as real membership.
- **Fix (00031):** Platform admin allowlist only; RLS **SELECT-only** on state table; writes only via SECURITY DEFINER RPCs; preview does not expand RLS; stale preview rows cleared for non-admins.

### C. `get_effective_role()`

- **Issue:** JWT `auth.jwt() ->> 'role'` fallback when no membership; impersonation branch without org join validation; overloaded `user_id` argument assumed in client but not in SQL.
- **Fix (00031):** Split `get_membership_role_context()` (authoritative for access) vs preview-aware `get_effective_role()`; remove JWT fallback; preview only when platform admin.

### D. `user_organization_members`

- **Issue:** Broad “admin” role list allowed lower roles (e.g. `admin`) to assign ministry roles; self-promotion possible; last owner could be removed/demoted.
- **Fix (00031):** `membership_role_rank()` + trigger `enforce_user_organization_members_authorization`; exception for first owner on new org.

### E. Service-role access

- **Issue:** `GET /api/operations/farms` used `SUPABASE_SERVICE_ROLE_KEY` when set, bypassing RLS after auth.
- **Fix:** Removed service-role client; searches use session client only.

### F. SECURITY DEFINER RPCs

| Function | Risk (before) | Mitigation (00031) |
|----------|---------------|---------------------|
| `create_organization_with_owner` | Privileged org creation | Type gate + platform admin |
| `set_impersonation` / `clear_impersonation` | Email domain gate | Platform admin gate |
| `get_effective_role` | JWT fallback, preview as auth | Membership split; preview UI-only |
| `get_user_visibility` | Used preview role | Uses `get_membership_role_context()` |
| `can_user_access` | Preview granted org access | Preview branch removed |
| `bootstrap_first_platform_admin` | N/A (new) | Service role only, single-row bootstrap |
| Legacy `get_user_organization_ids` / `is_org_admin` | Point at `memberships` | Unchanged; still used by legacy RLS |

---

## 3. Application-layer changes

| File | Change |
|------|--------|
| `hooks/use-platform-capabilities.ts` | New — `get_my_auth_capabilities` RPC |
| `hooks/use-organization.ts` | Preview org context via platform admin RPC (not email) |
| `hooks/use-role-navigation.ts` | Platform admin preview for menu; removed JWT metadata fallback |
| `app/dashboard/settings/*` | Hide government org types from non–platform admins |
| `app/dashboard/supply-overview/page.tsx` | Removed `@growa.ai` + impersonation org bypass |
| `components/dashboard/satellite-map.tsx` | Map edit tools gated on platform admin flag |
| `app/api/operations/farms/route.ts` | Session-only reads |
| `lib/auth/membership-authorization.ts` | Pure policy helpers + Vitest coverage |

---

## 4. Bootstrap strategy

- Table: `public.platform_admins` (no direct authenticated access).
- **First admin:** `bootstrap_first_platform_admin(uuid)` — **service role / postgres only**, fails if any row exists or if called with a user JWT.
- **Additional admins:** `grant_platform_admin(uuid)` — caller must already be platform admin.
- Procedure template: `scripts/sql/bootstrap-platform-admin.sql`
- **No** email-domain inference; **no** automatic promotion of existing accounts in migration.

---

## 5. Data preservation

- No drops of auth, profiles, organizations, or membership tables.
- Migration clears **preview flags** only for non–platform-admin users (does not delete users).
- Rollback plan: see `docs/USER_MANAGEMENT_MIGRATION_PLAN.md`.

---

## 6. Tests added

- `lib/auth/membership-authorization.test.ts` — org creation types, self-promotion, last owner, rank limits
- `lib/auth/organization-types.test.ts` — UI org type filtering

Database integration tests require local Supabase with migration `00031` applied (not run in CI for this phase).

---

## 7. Unresolved / follow-up risks

| Risk | Severity | Notes |
|------|----------|-------|
| Dual membership models (`memberships` vs `user_organization_members`) | Medium | Consolidation deferred; `can_user_access` still checks both |
| Legacy RLS on operations tables using `role_templates` | Medium | Not rewritten in Phase 1 |
| Client hooks (`use-data-access`) trust org **type** from loaded org | Medium | Preview changes UI context only; RLS must enforce data (verified for supply tables) |
| `profiles` SELECT may hide peer emails in team UI | Low | Pre-existing RLS |
| Hosted DB not migrated | High until applied | App degrades gracefully if RPCs missing |
| Platform admin map editing | Low | Operational choice; now explicit allowlist |

---

## 8. Manual deployment requirements

1. Apply `supabase/migrations/00031_user_management_security_hardening.sql` on target project (after review).
2. Run bootstrap SQL once with verified UUID (service role).
3. Remove `SUPABASE_SERVICE_ROLE_KEY` from app runtime if it was only used for farm search (no longer required for that path).
4. Verify platform admin can use role preview; verify ordinary users cannot call `set_impersonation`.
5. Regression-test organization creation, team invite, and supply overview for real members.

---

*Phase 1 implementation branch: `cursor/user-mgmt-security-hardening-8604`.*
