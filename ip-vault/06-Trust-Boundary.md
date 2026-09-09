# Trust Boundary

← [[05-Governance-Compliance]] · [[00-Index]] · [[07-IP-Register]]

---

## Security Posture

Trust is architectural, not additive. Growa enforces isolation at every layer — from the browser perimeter to the database.

> [!blackbox] Trust Boundary
> Client sees authorized views only.  
> Server holds all secrets. Database enforces final access.  
> Policy logic: **protected**.

---

## Perimeter Model

```
┌────────────────────────────────────────┐
│  CLIENT                                │
│  · Session cookies (HTTP-only)         │
│  · Public configuration only           │
│  · No provider credentials             │
├────────────────────────────────────────┤
│  APPLICATION GATEWAY                   │
│  · Session validation                  │
│  · Permission pre-checks               │
│  · External service proxying           │
├────────────────────────────────────────┤
│  DATA ISOLATION ENGINE                 │
│  · Row-level enforcement               │
│  · Membership verification             │
│  · Scope predicates [protected]        │
└────────────────────────────────────────┘
```

---

## Identity & Access

> [!card] Invitation-Only Onboarding
> No public registration. Administrators invite authorized users. Secure token activation.

> [!card] Session Management
> Short-lived access tokens · Automatic refresh · Invalidation on credential change

> [!card] Account States
> Active · Pending · Suspended · Revoked

```typescript
// Abstract access contract — not production source
interface AccessDecision {
  outcome:   'GRANTED' | 'DENIED' | 'SUMMARY' | 'PENDING_APPROVAL'
  layers:    ResolvedPermissionStack    // six layers, logic protected
  scope:     GeoAndObjectBoundary       // predicate protected
}
```

---

## Six-Layer Permission Model

```
1 · Country instance     — deployment boundary
2 · Organization         — institution membership
3 · Department           — subdivision scope
4 · Geographic scope     — region / municipality
5 · Object scope         — farm / site / unit
6 · Action permission    — read / write / approve / admin
```

Effective access = role template + scoped assignments. Never flattened to a single role string.

---

## Data Isolation

> [!card] Default Deny
> No data access unless explicitly granted by policy.

> [!card] Organization Scoping
> Every record belongs to a tenant. Cross-tenant access requires explicit sharing agreement.

> [!card] Defense in Depth
> Application checks AND database enforcement. A client bug cannot bypass isolation.

RLS policy predicates, helper functions, and RPC internals: **protected**.

---

## API Surface (Abstract)

| Category | Purpose |
|----------|---------|
| Operations | Farm registry, map objects, crop insights |
| Weather | Proxied environmental data |
| Intelligence | Server-side AI briefings |

```typescript
// Abstract route contract — not production source
async function handleSecureRequest(
  req: AuthenticatedRequest,
  handler: AuthorizedHandler
): Promise<SafeResponse | ErrorResponse> {
  const session = await validateSession(req)       // protected
  if (!session) return ErrorResponse.UNAUTHORIZED
  const allowed = await resolveAccess(session)     // protected
  if (!allowed) return ErrorResponse.FORBIDDEN
  return handler(session)
}
```

---

## Roadmap (Non-Secret)

| Capability | Phase |
|------------|-------|
| Email + password | Active |
| Enterprise SSO | Planned |
| Multi-factor authentication | Planned |
| Session management UI | Planned |

Implementation timelines and provider configurations: deployment-specific.
