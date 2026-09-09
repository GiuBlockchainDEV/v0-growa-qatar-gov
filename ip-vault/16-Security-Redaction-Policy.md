# Security Redaction Policy

← [[15-IP-Claims-Summary]] | [[00-Index]] | Next: [[17-Glossary]]

---

## Purpose

This document records what was **deliberately excluded** from the IP Vault and why. It ensures the deposit establishes intellectual property without creating security vulnerabilities or exposing confidential business information.

---

## Excluded: Credentials & Secrets

| Item | Reason |
|------|--------|
| API keys (AI, weather, database) | Direct security risk if disclosed |
| Service role keys | Full database bypass capability |
| Public/private key pairs | Authentication compromise |
| Environment variable values | Operational security |
| Hardcoded fallback credentials in source | Attack surface |

**Safe alternative documented:** "Secrets injected at deployment time via environment configuration."

---

## Excluded: Infrastructure Identifiers

| Item | Reason |
|------|--------|
| Production database hostnames | Targeted attack vector |
| Project IDs and instance names | Infrastructure reconnaissance |
| Deployment URLs (preview, staging, production) | Unauthorized access attempts |
| CDN and storage bucket names | Data exfiltration risk |
| Internal CI/CD pipeline details | Supply chain attack surface |

**Safe alternative documented:** "Managed backend service with isolated per-deployment instances."

---

## Excluded: Security Implementation Details

| Item | Reason |
|------|--------|
| Exact RLS policy SQL predicates | Policy bypass research |
| RPC function source code | Authorization logic reverse-engineering |
| Token hashing algorithms and parameters | Invitation/reset token attacks |
| Rate limiting thresholds | Brute force optimization |
| IP allowlist CIDR ranges | Network access mapping |
| Session token expiry exact values | Session hijacking timing |

**Safe alternative documented:** Conceptual security strategy (default deny, membership-based, server-side enforcement).

---

## Excluded: Internal Admin Tooling

| Item | Reason |
|------|--------|
| Admin email domain patterns | Privilege escalation targeting |
| Impersonation RPC mechanics | Unauthorized role assumption |
| Impersonation state persistence | Session manipulation |
| Debug and QA backdoors | Unauthorized access |

**Safe alternative documented:** "Internal quality assurance tooling exists; details confidential."

---

## Excluded: Partner & Operational Data

| Item | Reason |
|------|--------|
| Seeded organization names and UUIDs | Deployment-specific intelligence |
| Real farm and producer names | Privacy and commercial sensitivity |
| Live production metrics | Operational intelligence |
| External reference URLs in records | Third-party relationship mapping |
| Specific ministry personnel roles | Organizational structure intelligence |

**Safe alternative documented:** Generic organization type examples and illustrative role templates.

---

## Excluded: Exact Permission Matrices

| Item | Reason |
|------|--------|
| Role-to-permission flag exact mappings | Privilege escalation planning |
| Organization type visibility tables | Access boundary mapping |
| Shared layer assignment rules | Data layer bypass research |

**Safe alternative documented:** Permission model architecture and flag definitions without exact mappings.

---

## Redaction Verification Checklist

Before any IP document is published or deposited:

- [ ] No API keys, tokens, or passwords present
- [ ] No production URLs or hostnames
- [ ] No exact RLS or RPC implementation code
- [ ] No internal admin domain references
- [ ] No real organization or personnel identifiers
- [ ] No live operational data or metrics
- [ ] No infrastructure topology details
- [ ] Conceptual descriptions used for all security mechanisms

---

## Related Notes

- [[11-Row-Level-Security]]
- [[10-Auth-Access-Model]]
- [[00-Index]]
