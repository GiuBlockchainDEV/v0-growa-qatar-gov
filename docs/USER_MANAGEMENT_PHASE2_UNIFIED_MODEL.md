# User Management Phase 2 — Unified Identity & Authorization

**Date:** 31 October 2026 (Asia/Qatar)

## Canonical model

| Concept | Source of truth |
|---------|-----------------|
| Identity | Supabase `auth.users` |
| Profile | `public.profiles` |
| Organization | `public.organizations` (`organization_type` / `type` synced; read via `organization_type_value()`) |
| Membership | **`public.user_organization_members`** (canonical) |
| Legacy membership | `public.memberships` + `role_templates` → exposed via `list_legacy_memberships_for_user()` and one-time backfill |
| Role | `lib/auth/role-registry.ts` + `public.role_definitions` |
| Permission | Capability keys in `lib/auth/capabilities.ts`, resolved in `lib/auth/authorization.ts` |
| Platform staff | `public.platform_admins.staff_tier` (`super_admin` \| `support`) |
| Active organization | Validated via `/api/auth/session-context` + URL `organizationId` + local storage |

## Server authorization

- **`lib/auth/authorization-service.ts`** — builds session context, `requirePermission()` for API routes.
- **`GET /api/auth/session-context`** — memberships, permissions, active org validation.
- **`POST /api/auth/active-organization`** — explicit tenant switch with membership revalidation.

Frontend hooks consume session results for UX; **RLS and server checks remain authoritative**.

## Multi-organization context

- **`ActiveOrganizationProvider`** (dashboard layout) loads session context.
- Org switcher in **`PlatformShellControls`** when the user has multiple memberships.
- Switch clears stale tenant cache via `invalidateOrganizationCache()` and updates URL `organizationId`.

## Platform vs organization administration

| Tier | Capabilities (examples) |
|------|-------------------------|
| Platform super admin | `platform.config.manage`, `platform.organizations.provision`, `platform.staff.manage`, `audit.view` |
| Platform support | `platform.support.tools`, `users.view`, `organizations.view` (no automatic gov/commercial data access) |
| Organization admin | `users.manage`, `roles.assign`, org-scoped edit permissions |
| Approver roles | `decisions.approve` only on designated roles (e.g. `ministry_admin`, `hassad_admin`) |

## Migration

- **`00032_unified_identity_authorization.sql`** — staff tiers, role registry table, legacy mapping RPC, idempotent backfill, extended `get_my_auth_capabilities`.

## Tests

- `lib/auth/authorization.test.ts`
- `lib/auth/role-registry.test.ts`
- Existing Phase 1 auth tests retained

## Manual verification

1. User with two orgs must select active org (or use switcher).
2. Switch org → permissions and role label update.
3. Legacy-only membership appears after migration backfill.
4. Alerts API returns 403 without `intelligence.view` capability.
