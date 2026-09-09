# Platform Architecture

← [[01-Executive-Summary]] | [[00-Index]] | Next: [[03-Technology-Stack]]

---

## Three-Layer Hierarchy

Growa uses a deliberate separation between reusable platform code and country-specific deployment:

```
Growa Platform (Base)
└── Growa Qatar (Country Deployment)
    ├── Government Ministry (Organization)
    │   └── Departments (Food Security, Inspection, etc.)
    ├── State Food Operator (Organization)
    ├── Financial Institution (Organization)
    └── Farm Companies (Organizations)
```

---

## Layer 1: Growa Platform (Base)

The shared foundation reused across future country deployments:

- Core application architecture and codebase
- Design system and component library
- Authentication and authorization framework
- Operational ontology (farm, greenhouse, sensor, alert, cycle, etc.)
- Module registry and navigation patterns
- AI briefing pipeline architecture
- Code conventions and extension points

**Intentionally country-agnostic:**
- No branding or legal labels
- No map data or geographic boundaries
- No organization-specific data
- No country-specific role presets beyond templates

---

## Layer 2: Country Deployment (Growa Qatar)

Each sovereign deployment customizes:

| Element | Qatar Customization |
|---------|---------------------|
| Branding | National colors, bilingual labels |
| Legal labels | State terminology, ministry names |
| Organizations | Authorized national entities |
| Regions | National municipalities and geography |
| Map layers | Country satellite and operational overlays |
| Role presets | Government structure templates |
| Language | Arabic and English |

**Isolation principle:** Each future deployment (e.g., other GCC countries) receives its own isolated database instance. No cross-country data sharing at infrastructure level.

---

## Layer 3: Organizations

Within a country deployment, multiple authorized organizations operate:

| Organization Type | Description |
|-------------------|-------------|
| `government_master` | Top-level government authority |
| `government` | Government departments and agencies |
| `farm_company` | Licensed agricultural operators |
| `private` | Approved private entities |
| `public` | Public-sector operators |

### Key Principles

1. **Multi-actor, not ministry-only** — Platform serves diverse institution types
2. **Organization scoping** — Users belong to organizations with defined roles
3. **Data isolation** — Organizations see own data unless explicit cross-org sharing
4. **Shared infrastructure** — Common deployment, isolated tenant data

---

## Access Model

```
Country Instance
└── Organization
    └── Department (optional)
        └── User Membership
            ├── Role (permission template)
            └── Scope (region, farm, object boundaries)
```

See [[10-Auth-Access-Model]] for permission resolution.

---

## Application Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│  Browser (React / Next.js App Router)               │
│  ├── Map-centric dashboard shell                    │
│  ├── Module workspaces (slide-over panels)          │
│  └── Auth + i18n context providers                │
├─────────────────────────────────────────────────────┤
│  Server Layer (Next.js API Routes / BFF)          │
│  ├── Operations APIs (farms, map points, insights)  │
│  ├── Weather proxy (keys never exposed to client)   │
│  └── AI analysis endpoint (server-side only)        │
├─────────────────────────────────────────────────────┤
│  Data Layer (PostgreSQL via managed backend)        │
│  ├── Auth service (identity, sessions)              │
│  ├── Row Level Security (tenant isolation)          │
│  └── RPC functions (complex authorization)          │
└─────────────────────────────────────────────────────┘
```

See [[14-API-Design]] and [[11-Row-Level-Security]].

---

## Deployment Model

| Environment | Purpose |
|-------------|---------|
| Local | Developer workstations |
| Preview | Staging and QA |
| Production | Sovereign national deployment |

Configuration is environment-driven via public-safe feature flags. Secrets are injected at deployment time and never committed to source control.

---

## Related Notes

- [[03-Technology-Stack]]
- [[04-Module-Registry]]
- [[09-Data-Model]]
- [[10-Auth-Access-Model]]
