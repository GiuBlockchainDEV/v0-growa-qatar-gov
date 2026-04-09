# Growa Qatar - Authentication Strategy

**Step 1.3: Auth strategy definition**

## Core Principles

1. **No Public Signup**: Users cannot self-register
2. **Invitation-Only**: All users are invited by authorized administrators
3. **Organization-Scoped**: Users belong to organizations with specific roles
4. **Supabase Auth**: Built on Supabase Auth for identity management
5. **Server-Side Privileged Operations**: Sensitive auth actions never exposed to client

## Sign-In Modes

### Primary: Email + Password

The default authentication method for all users:

```
User enters email → User enters password → Supabase Auth validates → Session created
```

**Implementation:**
- Supabase Auth `signInWithPassword`
- Session stored in secure HTTP-only cookies
- JWT tokens with short expiry (1 hour)
- Refresh token rotation enabled

### Future: SSO (Single Sign-On)

Reserved for government and enterprise organizations:

| Provider | Target Organizations |
|----------|---------------------|
| Azure AD | Ministry of Municipality |
| Google Workspace | Research entities |
| Okta | Enterprise partners |

**SSO Roadmap:**
- Phase 1: Email + Password only
- Phase 2: Azure AD integration for ministries
- Phase 3: Additional SSO providers as needed

## Invitation Flow

### Flow Overview

```
Admin initiates invitation
    ↓
System generates secure token (Edge Function)
    ↓
Email sent with activation link
    ↓
User clicks link, validates token
    ↓
User sets password
    ↓
User profile created
    ↓
Membership assigned (organization + role)
    ↓
User can sign in
```

### Invitation States

| State | Description |
|-------|-------------|
| `pending` | Invitation sent, not yet accepted |
| `accepted` | User activated account |
| `expired` | Token expired (72 hours default) |
| `revoked` | Admin cancelled invitation |

### Security Requirements

1. **Token Generation**: Cryptographically secure, single-use tokens
2. **Expiration**: 72-hour default expiry
3. **Rate Limiting**: Max 5 invitations per admin per hour
4. **Audit Trail**: All invitations logged with actor, target, timestamp
5. **Server-Side Only**: Invitation creation via Edge Function, never client

### Invitation Data Model

```typescript
interface Invitation {
  id: string
  email: string
  organization_id: string
  department_id?: string
  role_template_id: string
  invited_by: string // auth.uid of inviter
  token_hash: string // bcrypt hash of token
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: Date
  accepted_at?: Date
  created_at: Date
}
```

## Password Reset Flow

### Flow Overview

```
User requests reset
    ↓
System validates email exists
    ↓
Reset email sent (Supabase Auth)
    ↓
User clicks link
    ↓
User enters new password
    ↓
Password updated
    ↓
All sessions invalidated
    ↓
User redirected to sign in
```

### Security Requirements

1. **No Email Enumeration**: Same response whether email exists or not
2. **Token Expiry**: 1-hour expiry for reset tokens
3. **Single Use**: Token invalidated after use
4. **Session Invalidation**: All existing sessions cleared on reset
5. **Password Requirements**: Min 12 chars, complexity enforced

## Multi-Factor Authentication (MFA)

### MFA Roadmap

| Phase | Capability |
|-------|------------|
| Phase 1 | MFA disabled (feature flag off) |
| Phase 2 | Optional TOTP for sensitive roles |
| Phase 3 | Mandatory MFA for admin roles |

### Supported MFA Methods

1. **TOTP (Primary)**: Google Authenticator, Authy, etc.
2. **SMS (Backup)**: Qatar phone numbers only

### MFA Enforcement Rules

```typescript
interface MFAPolicy {
  // Role-based enforcement
  required_for_roles: string[] // e.g., ['org_master_admin', 'org_admin']
  
  // Grace period for enrollment
  enrollment_grace_days: number // e.g., 7 days
  
  // Bypass for specific contexts
  bypass_for_sso: boolean // SSO may provide its own MFA
}
```

### Feature Flag

```env
NEXT_PUBLIC_FEATURE_MFA=false  # Phase 1
NEXT_PUBLIC_FEATURE_MFA=true   # Phase 2+
```

## Session Management

### Session Lifecycle

1. **Creation**: On successful sign-in
2. **Refresh**: Automatic via refresh token (10-minute reuse interval)
3. **Expiration**: 1 hour for access token, 7 days for refresh token
4. **Invalidation**: On sign-out, password reset, or admin action

### Session Security

- HTTP-only cookies (not accessible via JavaScript)
- Secure flag in production
- SameSite=Lax to prevent CSRF
- Refresh token rotation enabled

### Concurrent Sessions

- Multiple sessions allowed by default
- Admin can force single-session for sensitive roles
- All sessions visible in user settings

## Account States

| State | Can Sign In | Description |
|-------|-------------|-------------|
| `active` | Yes | Normal active account |
| `pending` | No | Invited but not activated |
| `suspended` | No | Temporarily disabled by admin |
| `revoked` | No | Permanently disabled |

### State Transitions

```
pending → active (on activation)
active → suspended (admin action)
suspended → active (admin action)
active → revoked (admin action)
suspended → revoked (admin action)
```

## Auth Metadata vs Database

### JWT Claims (Coarse)

Stored in JWT for quick eligibility checks:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "app_metadata": {
    "country": "QA",
    "organization_id": "org-uuid",
    "role_hint": "operations_director"
  }
}
```

### Database (Fine-Grained)

Detailed permissions read from database:

- Full role definition
- Specific scopes (regions, departments)
- Permission matrices
- Organization memberships

**Rule**: Never push large permission matrices into JWT. Use JWT for coarse checks, database for fine-grained authorization.

## Implementation Checklist

### Phase 2 (Auth UX)

- [ ] Sign-in page with email/password
- [ ] Invitation activation flow
- [ ] Password reset flow
- [ ] Organization/workspace selection
- [ ] Account state handling (pending, suspended)

### Future Phases

- [ ] MFA enrollment UI
- [ ] SSO integration
- [ ] Session management UI
- [ ] Admin user management
