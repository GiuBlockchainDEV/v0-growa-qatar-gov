# User management — Phase 3 (account lifecycle & invitations)

## Database

Apply after Phase 1–2 migrations:

- `00037_phase3_account_lifecycle.sql` — `profiles.account_status`, `organization_invitations` (token hash only), audit helper.

## Server configuration

Set **`SUPABASE_SERVICE_ROLE_KEY`** on the Next.js server (never expose to the browser). Invitations, membership removal, and account suspension use it.

Optional: `NEXT_PUBLIC_FEATURE_MFA=true` to expose MFA enrollment UI.

## Flows

| Flow | Entry |
|------|--------|
| Request access (no public signup) | `/auth/sign-up` → `POST /api/access-requests` |
| Admin invite | Team → Invite → `POST /api/invitations` |
| Accept invite | `/auth/invite?token=…` → `POST /api/invitations/accept` |
| Password reset | `/auth/forgot-password`, `/auth/reset-password` |
| Account | `/dashboard/account` |

Development without email: API responses may include `devInviteUrl` when the service role sends mail via Supabase but delivery is unavailable.

## Authorization

- `users.invite` — create/resend/revoke invitations.
- `users.manage` — remove memberships (soft `inactive`), suspend/reactivate accounts.
- Session context blocks **suspended/deactivated** profiles (`403`).
- **`invited`** memberships do not grant org permissions until acceptance (`status = active`).

## Audit

Server writes to `audit_logs` via service role: invitation sent/accepted/revoked, membership removed, org switch, account suspend/reactivate.
