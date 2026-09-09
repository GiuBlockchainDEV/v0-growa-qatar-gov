# Row Level Security Strategy

← [[10-Auth-Access-Model]] | [[00-Index]] | Next: [[12-Growa-AI-Methodology]]

---

## Overview

Growa enforces data isolation at the **database layer** using PostgreSQL Row Level Security (RLS). This is a defense-in-depth approach: even if application code has a bug, unauthorized data access is blocked by the database itself.

---

## Core Principles

1. **Default deny** — No access unless explicitly granted by policy
2. **Membership-based** — Access tied to organization membership
3. **Organization scoping** — Users see only their organization's data
4. **Service role isolation** — Privileged server operations use elevated role that bypasses RLS
5. **No client-side trust** — Authorization never depends solely on frontend checks

---

## Policy Categories

| Category | Approach |
|----------|----------|
| **Read (SELECT)** | User must be member of owning organization |
| **Write (INSERT/UPDATE)** | User must have appropriate role within organization |
| **Delete** | Restricted to admin roles; soft delete preferred |
| **Cross-org** | Explicit sharing agreements required |

---

## Membership Verification Pattern

RLS policies verify access through organization membership:

- Check that `auth.uid()` matches an active membership record
- Verify the target row's `organization_id` matches the membership
- Optional geographic scope checks for region-scoped roles

*Note: Exact policy predicates are intentionally omitted from this document to prevent security disclosure.*

---

## Helper Functions

Database RPC functions support complex authorization without exposing logic to clients:

| Function Category | Purpose |
|-------------------|---------|
| Membership checks | Verify user belongs to organization |
| Visibility resolution | Determine shared layer access level |
| Effective role | Resolve role with delegation support |
| Organization creation | Atomic org + owner setup |

---

## RLS + Application Layer

```
User Request
    ↓
Middleware (session validation)
    ↓
API Route (permission flag check)
    ↓
Database Query (RLS policy enforcement)
    ↓
Response (only authorized rows returned)
```

Both application-level permission flags AND database RLS must pass.

---

## Audit & Compliance

- All significant data access patterns are auditable
- RLS provides immutable enforcement regardless of client manipulation
- Policy changes are versioned through migration files

---

## Related Notes

- [[10-Auth-Access-Model]]
- [[16-Security-Redaction-Policy]]
- [[09-Data-Model]]
