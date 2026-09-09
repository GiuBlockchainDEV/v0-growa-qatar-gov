# Authentication & Access Model

← [[09-Data-Model]] | [[00-Index]] | Next: [[11-Row-Level-Security]]

---

## Core Principles

1. **No public signup** — Users cannot self-register
2. **Invitation-only** — Administrators invite authorized users
3. **Organization-scoped** — Every user belongs to organizations with roles
4. **Server-side privilege** — Sensitive operations never exposed to client
5. **Layered permissions** — Never flattened to a single role string

---

## Authentication Methods

### Primary: Email + Password
- Managed identity service with secure session cookies
- Short-lived access tokens with refresh rotation
- Email verification before data access

### Roadmap: Single Sign-On
- Enterprise SSO for government organizations (Azure AD, etc.)
- Feature-flagged per deployment phase

### Roadmap: Multi-Factor Authentication
- TOTP for sensitive roles
- Mandatory MFA for administrative roles (phased rollout)

---

## Invitation Flow

```
Admin initiates invitation
    → Secure token generated (server-side only)
    → Email with activation link
    → User sets password
    → Profile and membership created
    → User can sign in
```

### Invitation States
`pending` → `accepted` | `expired` | `revoked`

### Security Controls
- Cryptographically secure single-use tokens
- Configurable expiration (default 72 hours)
- Rate limiting on invitation creation
- Full audit trail

---

## Permission Layer Stack

Effective permissions combine six layers:

```
Layer 1: Country Instance (deployment boundary)
Layer 2: Organization (institution type and membership)
Layer 3: Department (organizational subdivision)
Layer 4: Geographic Scope (region, municipality)
Layer 5: Object Scope (specific farms, sites)
Layer 6: Action Permissions (read, write, approve, admin)
```

**Rule:** Effective permissions = Role Template + Scoped Assignments

---

## Role Templates (Examples)

| Role Code | Scope | Key Capabilities |
|-----------|-------|------------------|
| `org_master_admin` | Organization-wide | Full admin control |
| `org_admin` | Department-scoped | User and workflow management |
| `food_security_director` | Country-wide view | Strategic oversight, executive reports |
| `regional_ops_officer` | Region-scoped | Regional operations and alerts |
| `agricultural_inspector` | Assigned scope | Inspections, evidence, findings |
| `agronomist` | Assigned scope | Crop and sensor data advisory |
| `compliance_officer` | Organization-wide | Compliance reports and audit |
| `analyst` | Assigned scope | Read-only dashboards and exports |
| `executive_readonly` | Organization-wide | KPIs without operational detail |
| `external_operator` | Own assets only | Restricted partner access |

---

## Permission Flags (Application Layer)

| Flag | Meaning |
|------|---------|
| `canView` | Read access to authorized data |
| `canEdit` | Create and update records |
| `canManageUsers` | Invite and manage team members |
| `canDeleteOrganization` | Organization deletion (restricted) |
| `canShareData` | Initiate cross-org data sharing |
| `canViewRegulatory` | Access regulatory layer data |
| `canViewCommercial` | Access commercial layer data |
| `canViewFinance` | Access financial layer data |
| `canViewTechnical` | Access technical support layer |

Mapped from organization type and role in application hooks.

---

## Permission Resolution Algorithm

```
1. Load user's organization memberships
2. For each membership, load role template permissions
3. Load scope assignments (geographic + object)
4. For each access check:
   a. Does role template grant the action?
   b. Does scope include the target entity?
   c. Does shared layer visibility permit access?
   d. If all pass → GRANTED; otherwise → DENIED
```

---

## Session Management

- HTTP-only secure cookies (not accessible via JavaScript)
- Access token expiry with automatic refresh
- Session invalidation on password reset and admin action
- Account states: `active`, `pending`, `suspended`, `revoked`

---

## JWT vs Database

**JWT (coarse):** Country, organization hint, role hint — for quick eligibility  
**Database (fine-grained):** Full permissions, scopes, memberships — for authorization decisions

**Rule:** Never embed large permission matrices in JWT tokens.

---

## Related Notes

- [[11-Row-Level-Security]]
- [[04-Module-Registry]]
- [[16-Security-Redaction-Policy]]
