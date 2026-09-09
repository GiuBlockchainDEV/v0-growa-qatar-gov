---
title: "Growa Platform — Intellectual Property Vault"
subtitle: "Public-Safe Edition — IP Deposit Documentation"
author: "Growa Platform"
date: "September 2026"
---

<div style="page-break-after: always;"></div>

# Growa Platform — Intellectual Property Vault

> **Version:** 1.0  
> **Date:** September 2026  
> **Purpose:** Formal record of proprietary software architecture, methods, and product design without exposing credentials, infrastructure secrets, or security-sensitive implementation details.

---

## About This Vault

This knowledge base documents the **Growa** agricultural operations platform and its first sovereign deployment, **Growa Qatar**. It is structured like an [Obsidian](https://obsidian.md) vault: interconnected notes, clear hierarchy, and cross-references.

**What this vault establishes (IP deposit):**
- Platform architecture and design patterns
- Product capabilities and analytical methods
- Data models at conceptual level
- AI briefing methodology
- Security and governance approach (high level)

**What this vault deliberately excludes:**
- API keys, credentials, and environment secrets
- Production URLs, project identifiers, and infrastructure endpoints
- Exact database security policy logic
- Internal admin tooling and impersonation mechanics
- Partner-specific operational data

---

## Navigation Map

### Platform Foundation
- 01-Executive-Summary — One-page positioning and value proposition
- 02-Platform-Architecture — Platform → Country → Organization hierarchy
- 03-Technology-Stack — Languages, frameworks, and infrastructure patterns

### Product & Capabilities
- 04-Module-Registry — Declarative workspace module system (core IP)
- 05-Intelligence-Workspaces — Water, energy, analytics, weather
- 06-Map-Centric-UX — Satellite map as national operating surface
- 07-Compliance-Governance — Inspections, cases, alerts, collaboration
- 08-Supply-Chain — Logistics and procurement visibility

### Technical IP
- 09-Data-Model — Conceptual entity relationships
- 10-Auth-Access-Model — Identity, roles, and permission layers
- 11-Row-Level-Security — Data isolation strategy (conceptual)
- 12-Growa-AI-Methodology — Grounded government briefing system
- 13-Internationalization — Bilingual EN/AR architecture
- 14-API-Design — Server-side BFF pattern

### Legal & Deposit
- 15-IP-Claims-Summary — Patent/trade-secret positioning
- 16-Security-Redaction-Policy — What was excluded and why
- 17-Glossary — Canonical terminology

---

## Ownership

**Growa Platform** and **Growa Qatar** are proprietary software.  
Rights reserved by the authorized deploying institution(s) in the State of Qatar.

---

## Tags

`#growa` `#ip-deposit` `#agriculture` `#sovereign-platform` `#qatar`


<div style="page-break-after: always;"></div>

# Executive Summary


---

## What Growa Is

**Growa** is a multi-country agricultural operations platform designed for sovereign government deployments. It unifies maps, operational data, resource intelligence, compliance workflows, supply visibility, and AI-assisted briefings in a single secure environment.

**Growa Qatar** is the first country deployment — a national digital operating system for Qatar's agricultural sector, customized with bilingual support (English and Arabic), national geography, and institution-specific workspaces.

---

## The Problem It Solves

Agricultural governance involves many actors: ministries, inspection teams, state food operators, financial institutions, and farm companies. Each needs visibility into production, water use, energy consumption, compliance, and supply — but data is often fragmented across spreadsheets, paper records, and disconnected systems.

Growa answers:

> *How can authorized institutions see the full agricultural picture, act together, and protect national food security?*

---

## Core Value Propositions

| Dimension | Value |
|-----------|-------|
| **Spatial intelligence** | Map-first UX connects every metric to geographic context |
| **Resource accountability** | Water and energy intensity measured per crop and per producer |
| **Sovereign control** | Each country deployment is isolated with its own data boundary |
| **Multi-tenant governance** | Organizations see only authorized data; collaboration is explicit |
| **Grounded AI** | Briefings cite live platform data; no autonomous decision-making |
| **Bilingual by design** | Full English/Arabic with RTL layout support |

---

## Target Users

- Government ministries (national oversight, policy, inspections)
- Field inspection teams (cases, evidence, corrective actions)
- State food operators (production and supply monitoring)
- Financial institutions (agricultural program oversight)
- Farm companies (site operations and resource tracking)
- Research and technical support bodies

---

## Platform in One Sentence

**Growa Qatar is the national command centre for agricultural operations — connecting maps, weather, water and energy analysis, food security planning, compliance, supply, and intelligence so Qatar can protect its food security today and plan for tomorrow.**

---

## Related Notes

- 02-Platform-Architecture
- 04-Module-Registry
- 12-Growa-AI-Methodology
- 15-IP-Claims-Summary


<div style="page-break-after: always;"></div>

# Platform Architecture


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

See 10-Auth-Access-Model for permission resolution.

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

See 14-API-Design and 11-Row-Level-Security.

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

- 03-Technology-Stack
- 04-Module-Registry
- 09-Data-Model
- 10-Auth-Access-Model


<div style="page-break-after: always;"></div>

# Technology Stack


---

## Frontend

| Component | Technology | Role |
|-----------|------------|------|
| Framework | Next.js 16 (App Router) | Server and client rendering, routing, API routes |
| UI Library | React 19 | Component model |
| Language | TypeScript (strict) | Type safety across codebase |
| Styling | Tailwind CSS 4 | Utility-first responsive design |
| Components | shadcn/ui + Radix UI | Accessible, composable UI primitives |
| Maps | Leaflet | Interactive satellite and operational map |
| Charts | Recharts | Analytics visualizations |
| Forms | React Hook Form + Zod | Validated form handling |
| Themes | next-themes | Light/dark mode support |

---

## Backend & Data

| Component | Technology | Role |
|-----------|------------|------|
| Database | PostgreSQL | Relational data store |
| Backend service | Managed auth + database platform | Identity, realtime, storage |
| Auth | SSR-compatible auth client | Session cookies, JWT refresh |
| Migrations | SQL migration files | Versioned schema evolution |
| Security | Row Level Security (RLS) | Database-enforced tenant isolation |

---

## AI & External Services

| Component | Technology | Role |
|-----------|------------|------|
| LLM | Google Gemini (server-side) | Government briefing generation |
| Weather | External weather API (proxied) | Grid-based agronomic data |
| Analytics | Vercel Analytics | Usage telemetry (optional) |

**Security pattern:** All external API keys are held server-side only. Client never receives provider credentials.

---

## Internationalization

| Component | Implementation |
|-----------|----------------|
| Locales | English (`en`), Arabic (`ar`) |
| Direction | Automatic RTL for Arabic |
| Storage | Browser localStorage persistence |
| Dictionaries | Flat key-value translation maps |

See 13-Internationalization.

---

## Development Tooling

- Package manager: pnpm
- Linting: ESLint with Next.js config
- Type generation: Database types synced from schema

---

## Architectural Conventions

1. **Server Components first** — Initial data fetched server-side where possible
2. **BFF API routes** — External services called only from server
3. **Context providers** — Theme → Auth → i18n composition at app root
4. **Feature flags** — MFA, SSO, realtime toggled via environment
5. **Idempotent migrations** — Defensive schema evolution for mixed DB states

---

## Related Notes

- 14-API-Design
- 11-Row-Level-Security
- 12-Growa-AI-Methodology


<div style="page-break-after: always;"></div>

# Module Registry — Core IP Artifact


---

## Overview

The **Module Registry** is a declarative, code-first catalog of every workspace module in the platform. It is a central intellectual property artifact: it encodes product intent, role-aware navigation, visibility rules, and UX blueprints in a single authoritative source.

Unlike ad-hoc route tables, the registry describes **what each module is for**, **who can see it**, and **what actions it supports** — before backend data is wired.

---

## Module Definition Schema

Each module entry contains:

| Field | Purpose |
|-------|---------|
| `id` | Stable module identifier (e.g., `national-overview`) |
| `label` | Display name, with optional role-specific overrides |
| `purpose` | One-line mission statement |
| `defaultContent` | Expected content when module loads |
| `allowedActions` | Permitted user actions in this module |
| `visibilityScope` | Org types, permissions, and data-layer requirements |
| `submenu` | Role-aware navigation items within the module |
| `icon` | Visual identifier for sidebar |

---

## Visibility Scope Model

Modules are shown only when all visibility conditions pass:

```typescript
interface ModuleVisibilityScope {
  allowedOrgTypes: OrgType[] | '*'        // Which organization types
  requiredPermissions: PermissionFlag[]   // Required capability flags
  requiredLayerVisibility?: {             // Shared data layer access
    regulatory?: VisibilityLevel[]
    commercial?: VisibilityLevel[]
    finance?: VisibilityLevel[]
    technical_support?: VisibilityLevel[]
  }
}
```

**Visibility levels:** `FULL`, `SUMMARY`, `APPROVAL`, `NO`

This enables fine-grained control: a module may require regulatory layer access at `SUMMARY` or above, while another requires commercial `FULL` access.

---

## Role-Aware Labels and Submenus

The registry supports **role-specific UX** without duplicating module definitions:

- **Labels:** `ministry_inspector` may see "Alerts & Incidents" where `ministry_admin` sees "Alerts & Risks"
- **Submenus:** Inspector role gets inspection-focused map views; admin gets national map views

This pattern reduces navigation sprawl while preserving role-appropriate language.

---

## Role Menu Blueprints

Predefined navigation layouts per ministry role profile:

### Ministry Admin Blueprint
- **Landing:** National Overview
- **Primary:** National Overview, Live Map, Monitoring, Alerts, Compliance, Production & Harvest
- **Secondary:** Inter-Agency Collaboration, Programs & Policy, Reports, Support, Settings

### Ministry Inspector Blueprint
- **Landing:** Inspection Dashboard
- **Primary:** Inspection Dashboard, Live Map, Compliance Cases, Non-Conformities, Corrective Actions, Alerts
- **Secondary:** Farms & Sites, Evidence & Attachments, Reports, Support, Settings

---

## Registered Modules (Catalog)

| Module ID | Purpose |
|-----------|---------|
| `national-overview` | Sovereign executive situational awareness |
| `inspection-dashboard` | Inspector workload and queue management |
| `live-map` | Primary spatial decision surface |
| `monitoring` | Environmental and data health signals |
| `alerts-center` | Risk triage, escalation, and closure |
| `compliance-inspections` | Regulatory posture and inspection planning |
| `production-harvest` | Production readiness and harvest risk |
| `inter-agency-collaboration` | Cross-agency case and data exchange |
| `programs-policy` | Public program and policy tracking |
| `reports-center` | Institutional reporting packages |
| `compliance-cases` | End-to-end compliance case lifecycle |
| `non-conformities` | Violation severity and recurrence tracking |
| `corrective-actions` | Corrective action execution monitoring |
| `farms-sites` | Institutional farm and site registry views |
| `evidence-attachments` | Inspection evidence lifecycle |
| `support` | Institutional help and service requests |
| `settings` | Workspace configuration |

---

## Navigation Resolution Algorithm

When a user signs in, navigation is resolved through a priority chain:

1. **Code registry** — Ministry role blueprints filtered by visibility
2. **Database menus** — Per-role JSON navigation stored in `role_navigation` table
3. **Fallback** — Default minimal menu for unassigned roles

Each candidate module passes:
- Organization type check
- Permission flag check
- Shared layer visibility check

---

## Route Pattern

Modules use query-parameter routing to avoid 404s for in-progress features:

```
/dashboard?module=national-overview
/dashboard?module=live-map
```

Dedicated routes exist for mature features:
```
/dashboard/farms
/dashboard/supply-overview
/dashboard/settings
```

See 06-Map-Centric-UX.

---

## IP Significance

The Module Registry represents a **product ontology** — a machine-readable description of government agricultural software capabilities. It enables:

- Consistent role-based UX across deployments
- Country-specific customization without rewriting navigation
- Auditability of who can access what capability
- Progressive implementation (shell UI before backend wiring)

---

## Related Notes

- 05-Intelligence-Workspaces
- 07-Compliance-Governance
- 10-Auth-Access-Model
- 15-IP-Claims-Summary


<div style="page-break-after: always;"></div>

# Intelligence Workspaces


---

## Overview

Growa provides dedicated analytical workspaces that measure agricultural performance across water, energy, production, and weather dimensions. These workspaces share a common metrics pipeline and connect to the Growa AI briefing layer.

---

## Metrics Pipeline

```
Map polygons (custom_point_polygons)
        ↓
Farm crop insights (per-point production/water/energy)
        ↓
Workspace aggregates (national KPIs, rankings)
        ↓
Growa analysis context (structured digest)
        ↓
AI briefing (optional)
```

---

## Data Analytics Workspace

**Purpose:** Cross-resource performance view combining production, water, and energy.

### Analytical Outputs

| Metric | Description |
|--------|-------------|
| Total production | Estimated tons across monitored network |
| Resource intensity | Combined water + energy per ton of output |
| Efficiency scores | Per-area and per-producer performance |
| Crop matrix | Farms, output, resources, and scores by crop |
| Producer rankings | Efficiency, volume, and intensity leaders |
| Data gaps | Crops or areas with incomplete monitoring |

### User Actions
- Compare crop portfolio performance
- Identify top and at-risk producers
- Navigate from table rows to map locations
- Request executive briefings via Growa AI

---

## Water Intelligence Workspace

**Purpose:** Measure water consumption relative to agricultural output.

### Analytical Outputs

| Metric | Description |
|--------|-------------|
| Total water consumption | Cubic metres across monitored areas |
| Water intensity | m³ per ton of crop production |
| Irrigation pressure | Water share of total resource use |
| Crop breakdown | Water use and intensity by crop type |
| Producer rankings | Farms ranked by water efficiency |
| Quality scores | Linked to monitored production polygons |

### Policy Questions Answered
- Which crops consume disproportionate water for their output?
- Which producers need conservation support or inspection?
- Where is national water use concentrated?

---

## Energy Intelligence Workspace

**Purpose:** Track energy consumption across agricultural operations.

### Analytical Outputs

| Metric | Description |
|--------|-------------|
| Total energy consumption | kWh across monitored operations |
| Energy intensity | kWh per ton of production |
| Average per site | Energy use per farm or facility |
| Crop breakdown | Energy demand by crop type |
| Producer rankings | Efficiency leaders and laggards |

### Policy Questions Answered
- Which operations have unusually high energy demand?
- How does energy input relate to food output nationally?
- Where should efficiency programmes focus?

---

## Weather Workspace

**Purpose:** National grid weather with agronomic risk indicators.

### Coverage
- Entire national territory via configurable grid
- Current conditions and historical trends per grid cell

### Analytical Domains

| Domain | Insight |
|--------|---------|
| Light & solar radiation | Greenhouse and growth planning |
| Temperature & humidity | Heat stress and moisture |
| Wind | Spraying safety, structural risk |
| Rainfall | Recent precipitation windows |
| Irrigation indicators | Evapotranspiration, water stress |
| Agronomic risk | Disease risk, thermal stress indices |

### User Actions
- Select any grid cell for environmental profile
- Compare weather trends over time
- Plan irrigation and field operations proactively

---

## RSS Information Feed

Curated external news and information alongside the operational map — agricultural news, market signals, and policy context without leaving the workspace.

---

## Shared UI Patterns

All intelligence workspaces share:
- Slide-from-left panel over the persistent map
- Consistent KPI cards and data tables
- Map navigation from data rows to geographic locations
- Optional Growa AI briefing panel with preset prompts

---

## Related Notes

- 06-Map-Centric-UX
- 12-Growa-AI-Methodology
- 09-Data-Model
- 08-Supply-Chain


<div style="page-break-after: always;"></div>

# Map-Centric User Experience


---

## Design Philosophy

Agriculture is inherently spatial. Growa treats the **interactive satellite map** as the persistent operating surface — not a secondary widget. All analytical workspaces slide over the map, preserving geographic context while presenting data.

> *Every number on a dashboard should lead to a place on the ground.*

---

## Map Shell Architecture

```
┌──────────────────────────────────────────────┐
│  Header (org context, user menu, language)   │
├──────────┬───────────────────────────────────┤
│ Sidebar  │                                   │
│ (modules)│     Satellite Map (persistent)    │
│          │                                   │
│          │  ┌─────────────────────────┐      │
│          │  │ Workspace Panel         │      │
│          │  │ (slides from left)      │      │
│          │  └─────────────────────────┘      │
└──────────┴───────────────────────────────────┘
```

---

## Map Capabilities

| Capability | Description |
|------------|-------------|
| National → site zoom | From country view to individual farm |
| Layer presets | Toggle operational overlays |
| Search & locate | Find farms, facilities, points |
| Saved views | Persist operational map configurations |
| Custom map points | User-drawn markers (farm, facility, sensor) |
| Polygon overlays | Operational areas with crop and resource metrics |
| Scope switching | National, regional, or inspection-focused views |

---

## Custom Map Objects

### Map Points
User-placed markers representing farms, facilities, sensors, or other operational sites. Bilingual labels supported.

### Polygons
Drawn operational areas linked to:
- Crop type assignment
- Production, water, and energy totals
- Performance scores
- External reference links (when authorized)

### Crop Insights
Per-point analytical records aggregating production and resource metrics — the foundation for intelligence workspace calculations.

---

## Navigation Integration

- Module selection via `?module=` query parameter keeps map mounted
- Clicking a data table row pans/zooms map to corresponding location
- Inspector role receives inspection-focused map submenu items
- Admin role receives national and regional map views

---

## UX IP Claims

1. **Persistent map shell** — Analytical panels are overlays, not page replacements
2. **Bidirectional data-map linking** — Tables and map are always connected
3. **Role-aware map modes** — Same map, different operational lenses per role
4. **Progressive module loading** — Registry-defined shells render before full backend wiring

---

## Related Notes

- 04-Module-Registry
- 05-Intelligence-Workspaces
- 09-Data-Model


<div style="page-break-after: always;"></div>

# Compliance & Governance Workspaces


---

## Overview

Government and inspection teams use dedicated workspaces to enforce agricultural standards, manage compliance cases, and coordinate regulatory action across Qatar's agricultural sector.

These modules are defined in the 04-Module-Registry and gated by the `regulatory` shared data layer.

---

## Inspection Dashboard

**Audience:** Field inspectors  
**Purpose:** Daily workload management

### Capabilities
- Personal inspection queue
- Items due this week
- High-priority cases
- Assigned regions
- Open findings tracker
- Completion status metrics

---

## Compliance & Inspections

**Audience:** Regulatory leadership  
**Purpose:** Institutional compliance posture

### Capabilities
- Inspection planning and scheduling
- Non-conformity pipeline
- Corrective action tracking
- Compliance score trends
- Regulatory report generation

---

## Compliance Cases

**Purpose:** End-to-end case lifecycle management

### Case States
- Open → In Review → Awaiting Evidence → Escalated → Closed

### Capabilities
- Case queue grouped by state
- Evidence completeness tracking
- Escalation workflows
- Map-linked case locations

---

## Non-Conformities

**Purpose:** Track violation patterns

### Analytical Views
- Open non-conformities by severity
- Geographic distribution (by region, by farm)
- Repeat offender identification
- Severity breakdown trends

---

## Corrective Actions

**Purpose:** Monitor remediation execution

### Queues
- Open actions
- Overdue actions
- Pending verification
- Closed actions

Ensures identified problems are actually resolved, not just documented.

---

## Evidence & Attachments

**Purpose:** Documentary trail for compliance decisions

### Capabilities
- Media uploads (photos, documents)
- Evidence library
- Case-linked attachments
- Missing evidence alerts
- Signed report storage

---

## Alerts & Risk Management

**Purpose:** Centralised risk triage

### Coverage
- Active operational and compliance alerts
- Critical incidents
- Risk hotspots (geographic concentrations)
- Escalation tracking
- Resolved vs. open trend analysis

### Actions
- Acknowledge alerts
- Escalate to appropriate authority
- Link alerts to compliance cases and map locations

---

## Inter-Agency Collaboration

**Purpose:** Structured cooperation between authorized agencies

### Capabilities
- Shared cross-organization cases
- Data sharing requests with approval workflow
- Visibility rules (full, summary, approval-gated)
- Collaboration audit log

Prevents both data silos and uncontrolled informal sharing.

---

## Programs & Policy Tracking

**Purpose:** Monitor public agricultural programmes

### Analytical Views
- Programme enrollment status
- Regional coverage gaps
- Programme exceptions
- Incentive monitoring
- Policy performance against objectives

---

## Reports Center

**Purpose:** Institutional reporting for leadership and regulators

### Report Types
- Executive summaries
- Compliance and inspection reports
- Water use reports
- Production and harvest reports
- Programme performance reports
- Inspector-specific regional summaries

---

## Related Notes

- 04-Module-Registry
- 10-Auth-Access-Model
- 09-Data-Model


<div style="page-break-after: always;"></div>

# Supply Chain & Logistics


---

## Overview

For organizations responsible for sourcing, procurement, and distribution, the supply overview workspace monitors the flow of goods from origin to destination — closing the loop between field production and market availability.

---

## Strategic Context

Food security depends not only on what a nation grows, but on what it sources, imports, and distributes. Supply analysis complements production intelligence with logistics visibility.

---

## Key Performance Indicators

| KPI | Description |
|-----|-------------|
| Available contract volume | Supply contracted and ready |
| Goods in transit | Volumes currently moving through chain |
| At-risk deliveries | Shipments facing timeline or disruption risk |
| Average lead times | Origin-to-delivery duration trends |

---

## Supply Flow Records

Individual commodity flows tracked with:
- Commodity type
- Origin and destination
- Current status
- Estimated arrival
- Risk flags

---

## Action Queue

Open sourcing actions requiring attention — enabling proactive intervention before shortages materialize.

---

## Data Model (Conceptual)

| Entity | Purpose |
|--------|---------|
| `supply_overview_snapshots` | Daily KPI aggregates |
| `supply_flows` | Individual commodity movement records |
| `supply_action_queue` | Open sourcing actions |

See 09-Data-Model.

---

## User Experience

- Dedicated route: `/dashboard/supply-overview`
- Tailored for state food operator organization types
- Connects sourcing decisions with production outlook data from field intelligence

---

## Related Notes

- 05-Intelligence-Workspaces
- 09-Data-Model
- 01-Executive-Summary


<div style="page-break-after: always;"></div>

# Data Model — Conceptual Overview


---

## Design Principles

1. **Organization-scoped tenancy** — All operational data belongs to an organization
2. **Bilingual by default** — Names and descriptions in English and Arabic
3. **Geographic linkage** — Entities connect to map coordinates and regions
4. **Audit readiness** — Significant actions logged for compliance
5. **Defensive evolution** — Schema migrations are idempotent for mixed deployment states

---

## Domain Map

```
┌─────────────────────────────────────────────────────────┐
│                    AUTH & ACCESS                        │
│  country_instances, organizations, departments,         │
│  profiles, memberships, role_templates, invitations,    │
│  access_policies, audit_logs, role_navigation           │
├─────────────────────────────────────────────────────────┤
│                    OPERATIONS                           │
│  farms, production_units, crop_types, growing_cycles,   │
│  input_inventory, farm_activities, custom_map_points,   │
│  custom_point_polygons, farm_crop_insights,             │
│  gcc_crop_types, gcc_crop_varieties                     │
├─────────────────────────────────────────────────────────┤
│                    SUPPLY CHAIN                         │
│  supply_overview_snapshots, supply_flows,               │
│  supply_action_queue                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Auth & Access Domain

| Entity | Purpose |
|--------|---------|
| `country_instances` | Country deployment container |
| `organizations` | Multi-tenant actors (government, farm company, etc.) |
| `departments` | Subdivisions within organizations |
| `regions` | Geographic hierarchy (municipalities) |
| `profiles` | Application user profile (1:1 with identity) |
| `user_organization_members` | Active membership with role assignment |
| `memberships` | Blueprint membership with scope assignments |
| `role_templates` | Predefined permission templates |
| `permission_templates` | Granular domain/action permissions |
| `invitations` | Invitation-only onboarding records |
| `access_policies` | Organization security policies |
| `role_navigation` | Per-role menu configuration (JSON) |
| `role_delegations` | Temporary role delegation |
| `audit_logs` | Security and compliance audit trail |

---

## Operations Domain

| Entity | Purpose |
|--------|---------|
| `farms` | Registered agricultural sites |
| `production_units` | Fields, pens, tanks within farms |
| `crop_types` | Reference crop taxonomy |
| `livestock_types` | Livestock reference data |
| `aquaculture_species` | Aquaculture reference data |
| `growing_cycles` | Crop production lifecycle |
| `livestock_batches` | Livestock production batches |
| `aquaculture_cycles` | Aquaculture production cycles |
| `input_inventory` | Agricultural input stock |
| `farm_activities` | Operational activity log |
| `custom_map_points` | User-drawn map markers |
| `custom_point_polygons` | Polygon overlays with metrics and scores |
| `custom_crop_types` | User-defined crop labels |
| `gcc_crop_types` | GCC regional crop catalog |
| `gcc_crop_varieties` | Crop variety catalog |
| `farm_crop_insights` | Per-point production/water/energy totals |

---

## Supply Chain Domain

| Entity | Purpose |
|--------|---------|
| `supply_overview_snapshots` | Daily supply KPI aggregates |
| `supply_flows` | Individual commodity flow records |
| `supply_action_queue` | Open sourcing actions |

---

## Key Relationships

```
Organization ──< Farms ──< Production Units
Organization ──< Custom Map Points ──< Polygons ──< Crop Insights
Organization ──< Supply Flows
User ──< Memberships >── Organization
Role Template ──< Permission Templates
```

---

## Enumeration Types

Core enums include:
- Organization types: `government_master`, `government`, `farm_company`, `private`, `public`
- Farm types: crop, livestock, aquaculture, mixed
- Farm status: active, inactive, pending, suspended
- Invitation status: pending, accepted, expired, revoked
- Supply flow status: in-transit, delivered, at-risk, delayed

---

## Shared Data Layers

Cross-cutting visibility domains applied to modules:

| Layer | Content Domain |
|-------|----------------|
| `regulatory` | Compliance, inspections, water/food security |
| `commercial` | Harvest, traceability, supplier eligibility |
| `finance` | Farm dossier, KPIs, credit |
| `technical_support` | Device health, diagnostics |

Visibility levels: `FULL`, `SUMMARY`, `APPROVAL`, `NO`

---

## Related Notes

- 10-Auth-Access-Model
- 11-Row-Level-Security
- 05-Intelligence-Workspaces


<div style="page-break-after: always;"></div>

# Authentication & Access Model


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

- 11-Row-Level-Security
- 04-Module-Registry
- 16-Security-Redaction-Policy


<div style="page-break-after: always;"></div>

# Row Level Security Strategy


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

- 10-Auth-Access-Model
- 16-Security-Redaction-Policy
- 09-Data-Model


<div style="page-break-after: always;"></div>

# Growa AI Methodology


---

## Overview

**Growa AI** is a grounded government briefing system — not a general-purpose chatbot. It reads live operational data from the platform and produces structured, evidence-based briefings for authorized government users.

---

## Design Constraints

| Constraint | Rationale |
|------------|-----------|
| Grounded in platform data only | Prevents hallucinated farms, crops, or metrics |
| Server-side execution only | API keys never exposed to browser |
| Structured output format | Consistent executive briefing structure |
| English output only | Government briefing standard language |
| No autonomous decisions | AI accelerates understanding; humans retain authority |
| Data gap transparency | Explicitly flags missing or incomplete data |

---

## Pipeline Architecture

```
Dashboard Metrics (live workspace data)
        ↓
buildGrowaContext() — structured analysis context
        ↓
buildGrowaDigest() — human-readable operational digest
        ↓
Module-specific preset prompts
        ↓
Server API endpoint → LLM (Gemini)
        ↓
Structured markdown briefing
```

---

## Supported Modules

| Module | Briefing Focus |
|--------|----------------|
| `data-analytics` | Executive briefing, intervention priorities, food security outlook |
| `water-intelligence` | Water policy, conservation priorities, drought resilience |
| `energy-intelligence` | Efficiency assessment, grid pressure, decarbonization roadmap |

---

## Operational Digest Structure

The digest is the **single source of truth** passed to the LLM:

### National Headline
- Tracked crops, producers, and polygons
- Total production, water, and energy
- Average performance scores
- Top and lowest efficiency producers
- Module-specific focus metrics (water intensity, energy intensity, etc.)

### Crop Matrix
Per-crop breakdown: production share, water share, energy share, scores, farm count, intensity metrics

### Producer Rankings
Top producers by efficiency with production, resource use, and crop portfolio

### At-Risk Producers
Low efficiency / high resource pressure flags

### Data Alerts
Explicit gaps and anomalies in monitoring coverage

---

## Analysis Context Schema

Structured context object includes:
- `module` — Active workspace identifier
- `headline` — National KPI aggregates
- `crops[]` — Per-crop analytical rows
- `topProducers[]` — Efficiency leaders
- `atRiskProducers[]` — Flagged underperformers
- `alerts[]` — Data quality and coverage warnings
- `generatedAt` — Snapshot timestamp

---

## Output Format (5 Sections)

Every briefing follows a fixed structure:

1. **Executive Summary** — Key findings in plain language
2. **Evidence** — Metrics cited from the operational digest
3. **Risk Signals** — Outliers, at-risk producers, anomalies
4. **Recommended Actions** — Concrete government interventions
5. **KPIs & Data Gaps** — Measurable targets and missing data

---

## Anti-Hallucination Rules

Embedded in system prompts:
- Must cite digest metrics by name and value
- Must not invent farms, crops, or producers not in digest
- Must flag insufficient data via alerts section
- Must distinguish observation from recommendation
- Must not claim regulatory authority or make binding decisions

---

## Module-Specific Analysis Frameworks

Each workspace module defines an analytical methodology:

- **Water:** Intensity benchmarking, irrigation pressure, crop-level water accounting
- **Energy:** kWh/t efficiency, producer rankings, decarbonization pathways
- **Analytics:** Cross-resource efficiency, portfolio concentration, intervention prioritization

---

## UI Integration

`GrowaIntelligencePanel` component in intelligence workspaces provides:
- Preset prompt buttons (one-click briefings)
- Custom prompt input (within module scope)
- Markdown-rendered response display
- Loading and error states

---

## IP Significance

The Growa AI methodology represents a novel approach to **government-grade grounded AI**:

1. Pre-computed structured digest before LLM invocation
2. Module-specific analytical frameworks
3. Fixed output schema for executive consumption
4. Explicit anti-hallucination guardrails
5. Data gap transparency as first-class output

---

## Related Notes

- 05-Intelligence-Workspaces
- 14-API-Design
- 15-IP-Claims-Summary


<div style="page-break-after: always;"></div>

# Internationalization (i18n)


---

## Overview

Growa is designed for bilingual operation from the ground up. The Qatar deployment supports **English** and **Arabic** with full right-to-left (RTL) layout switching.

---

## Architecture

| Component | Implementation |
|-----------|----------------|
| Locales | `en` (default), `ar` |
| Direction | `ltr` for English, `rtl` for Arabic |
| Storage | Browser `localStorage` key for persistence |
| Provider | React context at application root |
| Toggle | User menu language switcher |

---

## Translation API

```typescript
const { locale, direction, setLocale, t } = useI18n()

// Usage
t('auth.sign_in')     // → "Sign In" or "تسجيل الدخول"
t('app.name')         // → "Growa Qatar" or localized equivalent
```

### Key Convention
Dot-notation keys organized by domain:
- `auth.*` — Authentication strings
- `app.*` — Application branding
- `common.*` — Shared UI labels
- `dashboard.*` — Dashboard-specific strings

Fallback: if key missing, the key itself is displayed (aids development).

---

## RTL Support

When Arabic is selected:
- `document.documentElement.dir` set to `rtl`
- `document.documentElement.lang` set to `ar`
- Layout components adapt via CSS logical properties and Tailwind direction utilities

---

## Bilingual Data Model

Operational entities store bilingual content:
- `name_en` / `name_ar` on farms, organizations, crops
- `description_en` / `description_ar` where applicable

UI displays content in the user's selected locale with fallback to English.

---

## Configuration

Environment-driven defaults:
- `NEXT_PUBLIC_DEFAULT_LOCALE` — Default locale (e.g., `en`)
- `NEXT_PUBLIC_SUPPORTED_LOCALES` — Comma-separated list (e.g., `en,ar`)

Country deployment config (`lib/config/country-qatar.ts`) defines Qatar-specific locale preferences.

---

## Coverage Scope

| Area | Bilingual |
|------|-----------|
| Authentication pages | ✅ Full |
| Dashboard navigation | ✅ Full |
| Common UI components | ✅ Full |
| Intelligence workspaces | Partial (metrics in English) |
| Growa AI briefings | English only (by design) |
| Database content | Bilingual fields where applicable |

---

## Related Notes

- 02-Platform-Architecture
- 03-Technology-Stack
- 09-Data-Model


<div style="page-break-after: always;"></div>

# API Design — Backend-for-Frontend Pattern


---

## Overview

Growa uses Next.js API routes as a **Backend-for-Frontend (BFF)** layer. All external service calls and privileged operations execute server-side. The browser never receives provider API keys.

---

## API Categories

### Operations APIs
| Endpoint Pattern | Methods | Purpose |
|------------------|---------|---------|
| `/api/operations/farms` | GET, POST | Farm registry management |
| `/api/operations/custom-map-points` | GET, POST | Map marker CRUD |
| `/api/operations/custom-point-polygons` | GET, POST | Polygon overlay management |
| `/api/operations/farm-crop-insights` | GET, POST | Per-point crop analytics |
| `/api/operations/crop-types` | GET, POST | Custom crop type catalog |

### Weather APIs (Proxied)
| Endpoint Pattern | Methods | Purpose |
|------------------|---------|---------|
| `/api/weather/by-coordinates` | GET | Current weather for lat/lng |
| `/api/weather/history/by-coordinates` | GET | Historical weather data |
| `/api/weather/grid` | GET | National grid weather cells |

### AI APIs
| Endpoint Pattern | Methods | Purpose |
|------------------|---------|---------|
| `/api/ai/growa/analyze` | POST | Server-side Growa AI briefing |

---

## Authentication Pattern

All API routes:
1. Validate session from secure cookies
2. Reject unauthenticated requests (401)
3. Rely on database RLS for data scoping
4. Return only authorized data

---

## Request/Response Conventions

- JSON request and response bodies
- Standard HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Error responses include safe error messages (no stack traces in production)
- Input validation via Zod schemas where applicable

---

## Server-Side Responsibilities

| Responsibility | Layer |
|----------------|-------|
| Session validation | API route middleware |
| Permission checks | API route + application hooks |
| Data scoping | Database RLS |
| External API calls | API route (keys in env only) |
| AI prompt assembly | Server-only AI module |
| Audit logging | Server-side on sensitive operations |

---

## Security Boundaries

```
┌─────────────────────────────────────┐
│  CLIENT (Browser)                   │
│  - Public env vars only             │
│  - Session cookies (HTTP-only)      │
│  - No API keys                      │
├─────────────────────────────────────┤
│  SERVER (Next.js API Routes)        │
│  - All provider API keys            │
│  - AI prompt construction           │
│  - Privileged database operations   │
├─────────────────────────────────────┤
│  DATABASE (PostgreSQL + RLS)        │
│  - Final data access enforcement    │
└─────────────────────────────────────┘
```

---

## Related Notes

- 12-Growa-AI-Methodology
- 11-Row-Level-Security
- 16-Security-Redaction-Policy


<div style="page-break-after: always;"></div>

# IP Claims Summary


---

## Purpose

This note summarizes the proprietary intellectual property embodied in the Growa platform, suitable for IP deposit, trade secret classification, or patent portfolio planning.

---

## Category 1: Platform Architecture

### Claim: Multi-Country Sovereign Deployment Model
A three-layer hierarchy (Platform → Country Deployment → Organization) enabling reusable codebase with sovereign data isolation per country instance.

**Novel elements:**
- Country-agnostic base with deployment-specific customization layer
- Isolated database per sovereign deployment
- Shared operational ontology across countries

---

## Category 2: Module Registry System

### Claim: Declarative Government Workspace Ontology
A code-first catalog defining workspace modules with role-aware labels, visibility scopes, shared data layer requirements, and navigation blueprints.

**Novel elements:**
- Role-specific label and submenu overrides within single module definitions
- Six-dimensional visibility scope (org type + permissions + shared layers)
- Progressive implementation pattern (shell UI before backend wiring)
- Ministry role menu blueprints with filtered resolution algorithm

---

## Category 3: Map-Centric UX

### Claim: Persistent Map Shell with Bidirectional Data-Map Linking
An analytical dashboard where the satellite map remains mounted while workspace panels slide over it, with every data table row linked to geographic coordinates.

**Novel elements:**
- Map-as-operating-surface (not map-as-widget)
- Role-aware map modes from single map instance
- Custom polygon overlays with embedded resource metrics and scores

---

## Category 4: Resource Intelligence Pipeline

### Claim: Cross-Resource Agricultural Performance Analytics
A metrics pipeline from map polygons through crop insights to national KPIs, producer rankings, and at-risk identification across water, energy, and production dimensions.

**Novel elements:**
- Water intensity (m³/t) and energy intensity (kWh/t) per crop and per producer
- Irrigation pressure as water share of total resources
- Unified efficiency scoring across resource dimensions
- National crop matrix with share percentages

---

## Category 5: Grounded Government AI

### Claim: Evidence-Based Government Briefing System
A structured AI pipeline that pre-computes an operational digest from live platform data before LLM invocation, with anti-hallucination guardrails and fixed executive output schema.

**Novel elements:**
- Operational digest as single source of truth for LLM
- Module-specific analytical frameworks and preset prompts
- Five-section fixed briefing format (Summary → Evidence → Risks → Actions → Gaps)
- Explicit data gap transparency as first-class output
- No autonomous decision-making; human authority preserved

---

## Category 6: Layered Permission Model

### Claim: Six-Layer Permission Resolution
Effective permissions computed from country instance, organization, department, geographic scope, object scope, and action permissions — never flattened to a single role string.

**Novel elements:**
- Shared data layer visibility (regulatory, commercial, finance, technical)
- Four visibility levels (FULL, SUMMARY, APPROVAL, NO)
- Database RPC functions for complex authorization resolution
- Dual navigation resolution (code registry + database menus)

---

## Category 7: Bilingual Sovereign Platform

### Claim: RTL/LTR Agricultural Government Platform
Full bilingual operation with automatic layout direction switching, bilingual data model fields, and country-specific locale configuration.

---

## Trade Secret vs. Publishable

| Asset | Classification |
|-------|----------------|
| Module registry definitions | Publishable (this vault) |
| Growa AI prompt templates | Trade secret |
| Operational digest algorithms | Publishable (conceptual) |
| RLS policy predicates | Confidential (excluded) |
| API keys and credentials | Confidential (excluded) |
| Role-permission exact mappings | Trade secret |
| Weather grid generation logic | Trade secret |

---

## Related Notes

- 04-Module-Registry
- 12-Growa-AI-Methodology
- 10-Auth-Access-Model
- 16-Security-Redaction-Policy


<div style="page-break-after: always;"></div>

# Security Redaction Policy


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

- 11-Row-Level-Security
- 10-Auth-Access-Model
- 00-Index


<div style="page-break-after: always;"></div>

# Glossary


---

## Platform Terms

| Term | Definition |
|------|------------|
| **Growa** | Multi-country agricultural operations platform (base) |
| **Growa Qatar** | First sovereign country deployment for the State of Qatar |
| **Country Instance** | Top-level deployment container for a sovereign nation |
| **Country Deployment** | Customized platform instance for a specific country |
| **Sovereign Platform** | National system where data belongs to the deploying state |

---

## Organizational Terms

| Term | Definition |
|------|------------|
| **Organization** | Authorized entity operating within a country deployment |
| **Organization Type** | Classification: government_master, government, farm_company, private, public |
| **Department** | Subdivision within an organization |
| **Membership** | Link between a user and an organization with role assignment |
| **Tenant** | Organization-scoped data boundary |

---

## Access Control Terms

| Term | Definition |
|------|------------|
| **Role Template** | Predefined permission set assigned to users |
| **Permission Flag** | Application-level capability (canView, canEdit, etc.) |
| **Scope Assignment** | Geographic or object-level access boundary |
| **Shared Data Layer** | Cross-cutting visibility domain (regulatory, commercial, finance, technical) |
| **Visibility Level** | Data access granularity: FULL, SUMMARY, APPROVAL, NO |
| **RLS** | Row Level Security — database-enforced data isolation |
| **BFF** | Backend-for-Frontend — server-side API proxy pattern |

---

## Product Terms

| Term | Definition |
|------|------------|
| **Module** | A workspace capability in the platform (e.g., Live Map, Water Intelligence) |
| **Module Registry** | Declarative catalog of all platform modules |
| **Workspace** | Analytical panel that slides over the map shell |
| **Map Shell** | Persistent satellite map underlying all workspaces |
| **Map Point** | User-placed marker on the operational map |
| **Polygon** | Drawn operational area with linked metrics |
| **Crop Insight** | Per-point analytical record (production, water, energy) |

---

## Intelligence Terms

| Term | Definition |
|------|------------|
| **Water Intensity** | Cubic metres of water per ton of crop production (m³/t) |
| **Energy Intensity** | Kilowatt-hours per ton of production (kWh/t) |
| **Irrigation Pressure** | Water's share of total resource consumption |
| **Efficiency Score** | Composite performance metric for producers/areas |
| **At-Risk Producer** | Farm flagged for low efficiency or high resource pressure |
| **Operational Digest** | Pre-computed data summary fed to Growa AI |
| **Growa AI** | Grounded government briefing system |

---

## Technical Terms

| Term | Definition |
|------|------------|
| **i18n** | Internationalization — multi-language support |
| **RTL** | Right-to-left text direction (Arabic) |
| **LTR** | Left-to-right text direction (English) |
| **SSR** | Server-Side Rendering |
| **App Router** | Next.js file-based routing system |
| **Migration** | Versioned database schema change file |
| **RPC** | Remote Procedure Call — database function invoked from application |

---

## Compliance Terms

| Term | Definition |
|------|------------|
| **Non-Conformity** | Documented violation of agricultural standards |
| **Corrective Action** | Required remediation following a non-conformity |
| **Compliance Case** | End-to-end regulatory case with evidence trail |
| **Inspection** | Field verification of agricultural compliance |
| **Evidence** | Documentary proof attached to inspections or cases |

---

← Back to 00-Index


<div style="page-break-after: always;"></div>

