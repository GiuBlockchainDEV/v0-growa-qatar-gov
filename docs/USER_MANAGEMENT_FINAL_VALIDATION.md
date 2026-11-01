# NFII User Management — Final validation (Phase 4)

This document summarizes the canonical model, permission matrix, verified workflows, limitations, and deployment steps after Phases 1–4.

## Canonical database model

| Entity | Table / RPC | Purpose |
|--------|-------------|---------|
| Identity | `auth.users`, `profiles` | Supabase Auth + profile (`account_status`, `department_scope`) |
| Membership | `user_organization_members` | Org role, `status` (`active` / `invited` / `inactive`) |
| Invitations | `organization_invitations` | Hashed token, lifecycle, email, role, scope |
| Platform staff | `platform_admins` | UUID allowlist, `staff_tier` |
| Organizations | `organizations` | `is_active` (00038), types gated on create |
| Audit | `audit_logs` | Append-only security events (server/service role) |
| Access requests | `organization_invite_requests` | User-initiated join requests (admin inbox TBD) |

Authorization logic: `lib/auth/capabilities.ts`, `role-registry.ts`, `authorization-service.ts` (`buildSessionContext`, `requirePermission`).

## Permission matrix (summary)

| Capability | Typical roles | Admin UI |
|------------|---------------|----------|
| `users.view` | admin, ministry_admin, hassad_admin, … | Users & roles, Access & permissions |
| `users.invite` | same + invite | Invitations, Invite dialog |
| `users.manage` | admin+ | Remove access, suspend/reactivate |
| `roles.assign` | admin+ | Role dropdown (server PATCH) |
| `organizations.view` | most | Organizations list |
| `organizations.manage` | org admin / platform | Org detail edit |
| `platform.organizations.provision` | platform staff | Create org (RPC), gov types |
| `audit.view` | ministry_admin+ | Security & audit |

Server enforcement: all mutations via `/api/admin/*`, `/api/invitations/*`, `/api/memberships/*`, `/api/account/lifecycle`, `/api/organizations/*` with `requirePermission` / service role.

## Verified workflows (automated)

| Check | Command | Result |
|-------|---------|--------|
| Unit tests | `npm test` | Auth, invitations, navigation filter, i18n |
| TypeScript | `npm run build` | Next.js production build |
| Lint | `npm run lint` | ESLint |

## End-to-end scenarios (local Supabase)

Use an isolated project with migrations **00031 → 00032 → 00034 → 00035 → 00036 (if needed) → 00037 → 00038** and `SUPABASE_SERVICE_ROLE_KEY` on Next.js.

### Seed personas (create via Auth + bootstrap)

| Persona | Setup | Expected |
|---------|--------|----------|
| Platform administrator | `bootstrap_first_platform_admin(uuid)` | Platform nav, org provision, all orgs |
| Organization administrator | Membership `admin`/`owner` active | Users & roles, invite, role assign |
| Ministry officer | `ministry_officer` active | No `users.manage`, view-only team if granted |
| Supply manager | `sourcing_manager` | Supply nav + optional users.invite (hassad profile) |
| Farm manager | `farm_manager` | Farm nav + team if `users.view` |
| Read-only analyst | `viewer` | No admin nav items |
| Multi-org user | Two active memberships | Org switcher, validated active org API |
| Suspended user | `profiles.account_status = suspended` | Session context **403** |
| No membership | Auth user, no rows | Dashboard with org selection / empty permissions |

### Manual test script

1. **Invite new user** — Team or Invitations → send → dev link or email → `/auth/invite?token=` → accept → membership `active`.
2. **Invite existing user** — magic link path → accept → only target org activated.
3. **Resend / revoke** — Invitations page → pending row actions → list refresh (no optimistic delete on failure).
4. **Role change** — Users & roles → role select → failed API keeps row unchanged.
5. **Remove access** — Remove → membership `inactive`, user still in Auth.
6. **Suspend** — Suspend → login blocked on session context.
7. **Password reset** — `/auth/forgot-password` → generic message → reset page.
8. **Direct API** — Call `/api/admin/users` without cookie → 401; wrong org → 403.
9. **Audit** — Security & audit page shows recent events for org admins with `audit.view`.
10. **Organizations** — Platform admin opens org detail → edit name → activate/deactivate.

## Navigation (Phase 4)

Registry keys (permission-filtered in `useRoleNavigation`):

- Users & roles → `/dashboard/team`
- Invitations → `/dashboard/invitations`
- Access & permissions → `/dashboard/access`
- My profile → `/dashboard/account`
- Security & audit → `/dashboard/audit`
- Organizations → `/dashboard/settings/organizations` (+ `/dashboard/organizations/[id]`)

## Unresolved limitations

- **Access request admin inbox**: users submit `organization_invite_requests`; no approve/reject UI yet.
- **Email delivery**: depends on Supabase Auth SMTP; dev shows `devInviteUrl` when appropriate.
- **MFA enforcement**: enrollment UI only; privileged MFA enforcement not wired to session gate.
- **Cross-org user search**: listing is scoped to active `organizationId`.
- **Legacy `memberships` table**: still bridged for read paths; canonical SSOT is `user_organization_members`.
- **Hosted migration order**: see `docs/USER_MANAGEMENT_MIGRATION_ORDER.md`.

## Deployment

1. Apply SQL migrations through **00038** on staging (non-destructive alters).
2. Set `SUPABASE_SERVICE_ROLE_KEY` on the app host only.
3. Configure Auth redirect URLs for invite and password reset.
4. Bootstrap at least one platform admin.
5. Deploy app from `main`; smoke-test personas above before production promotion.

Do **not** run destructive SQL or auto-deploy to production without explicit approval.
