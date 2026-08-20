# Growa Qatar — Platform Functions

**Last updated:** August 20, 2026  
**Audience:** Product owners, operators, developers, and stakeholders  
**Language:** English

This document describes the **exact functions** of the Growa Qatar platform as implemented in the current codebase. It covers what each module does, who can access it, and how the major features work together.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture and Tenancy Model](#2-architecture-and-tenancy-model)
3. [Authentication and User Access](#3-authentication-and-user-access)
4. [Roles, Permissions, and Navigation](#4-roles-permissions-and-navigation)
5. [Dashboard and Workspace Layout](#5-dashboard-and-workspace-layout)
6. [Core Modules and Functions](#6-core-modules-and-functions)
7. [Growa AI Assistant](#7-growa-ai-assistant)
8. [Operations Management](#8-operations-management)
9. [Data Sharing and Governance](#9-data-sharing-and-governance)
10. [Internationalization](#10-internationalization)
11. [API Endpoints](#11-api-endpoints)
12. [Security Model](#12-security-model)
13. [Implementation Status Summary](#13-implementation-status-summary)

---

## 1. Platform Overview

**Growa Qatar** is a sovereign agricultural operations platform for the State of Qatar. It provides government agencies, state operators, financial institutions, and approved agricultural organizations with a unified workspace to monitor farms, analyze resource use, manage compliance, and support national food security planning.

### What the platform does

| Capability | Description |
|------------|-------------|
| **Spatial operations** | Interactive satellite map of Qatar with farms, facilities, sensors, and custom map points |
| **Environmental intelligence** | Weather, water, and energy analytics tied to production data |
| **Regulatory oversight** | Ministry workspaces for inspections, compliance, alerts, and reporting |
| **Supply chain visibility** | Contract volume, in-transit flows, and delivery risk for sourcing roles |
| **AI-assisted analysis** | Growa Assistant generates government briefings from live dashboard data |
| **Multi-organization tenancy** | Isolated data per organization with controlled cross-agency sharing |
| **Bilingual interface** | Full English and Arabic support with RTL/LTR layout switching |

### Technology stack

- **Frontend:** Next.js 16, React 19, TypeScript, shadcn/ui, Tailwind CSS
- **Backend:** Next.js API routes, Supabase (PostgreSQL + Auth)
- **AI:** Google Gemini (via `/api/ai/growa/analyze`)
- **Maps:** Leaflet-based satellite map with Qatar-specific grid overlays

---

## 2. Architecture and Tenancy Model

Growa is designed as a **platform base** with **country deployments**. Growa Qatar is the first sovereign deployment.

```
Growa Platform (shared codebase)
└── Growa Qatar (country deployment)
    ├── Ministry of Municipality (organization)
    ├── Hassad Food (organization)
    ├── Qatar Development Bank (organization)
    └── Other authorized organizations
```

### Organization types

| Type | Code | Example |
|------|------|---------|
| Government master | `government_master` | Ministry of Municipality |
| Government agency | `government` | Agricultural Inspection |
| Farm company | `farm_company` | State or licensed farm operator |
| Private | `private` | Approved private operator |
| Public | `public` | Public-facing entities |

### Data isolation principles

1. Each organization owns its operational data.
2. Users see only data within their organization unless cross-organization sharing is explicitly granted.
3. Row Level Security (RLS) enforces isolation at the database level.
4. Shared data layers (regulatory, commercial, finance, technical support) have configurable visibility levels: `FULL`, `SUMMARY`, `APPROVAL`, or `NO`.

---

## 3. Authentication and User Access

### Sign-in

- **Method:** Email and password via Supabase Auth
- **Session:** Secure HTTP-only cookies with JWT tokens
- **Email verification:** Required before full data access
- **Password reset:** Available via email link
- **Protected routes:** All `/dashboard/*` routes require an authenticated session

### Auth pages

| Route | Function |
|-------|----------|
| `/auth/login` | Sign in with email and password |
| `/auth/sign-up` | Account creation (invitation-oriented workflow) |
| `/auth/callback` | Handles email verification and auth redirects |
| `/auth/sign-up-success` | Confirmation after successful registration |
| `/auth/error` | Displays authentication errors |

### Intended access model

The platform is designed for **invitation-only** access: administrators invite users, assign them to an organization, and grant a role. Self-service public signup exists in the UI but the strategic model is organization-controlled onboarding.

### Growa admin impersonation

Users with `@growa.ai` email addresses can:

- Operate in **Normal User** mode (minimal observer menu: Live Map, RSS Feed, Data Analytics)
- Switch to **View As** mode to impersonate a role within a specific organization for testing and support

---

## 4. Roles, Permissions, and Navigation

### Permission layers

Effective access is computed across six layers (never flattened into a single role string):

1. **Country instance** — Qatar deployment boundary  
2. **Organization** — Ministry, Hassad Food, QDB, etc.  
3. **Department** — Division within an organization  
4. **Region/geographic scope** — Doha, Al Wakrah, etc.  
5. **Object scope** — Specific farms, greenhouses, sensors  
6. **Action permissions** — read, write, approve, admin, export  

### Role templates (defined)

| Role | Code | Primary function |
|------|------|------------------|
| Organization Master Admin | `org_master_admin` | Full org administration |
| Organization Admin | `org_admin` | Department-scoped administration |
| Food Security Operations Director | `food_security_director` | Strategic national oversight |
| Regional Operations Officer | `regional_ops_officer` | Region-scoped day-to-day management |
| Agricultural Inspector | `agricultural_inspector` | Field inspections and evidence |
| Agronomist | `agronomist` | Crop and irrigation advisory |
| Compliance Officer | `compliance_officer` | Regulatory compliance and audit |
| Analyst / Viewer | `analyst` | Read-only dashboards and reports |
| Executive Read-Only | `executive_readonly` | High-level KPI visibility |
| External Operator | `external_operator` | Own assets only |

### Ministry workspace profiles

Two ministry role profiles drive the module registry navigation:

#### Ministry Admin (`ministry_admin`)

**Landing module:** National Overview  

**Primary modules:**
- National Overview
- Live Map
- Monitoring
- Alerts & Risks
- Compliance & Inspections
- Production & Harvest

**Secondary modules:**
- Inter-Agency Collaboration
- Programs & Policy
- Reports & Analytics
- Support
- Settings

#### Ministry Inspector (`ministry_inspector`)

**Landing module:** Inspection Dashboard  

**Primary modules:**
- Inspection Dashboard
- Live Map
- Compliance Cases
- Non-Conformities
- Corrective Actions
- Alerts & Incidents

**Secondary modules:**
- Farms & Sites
- Evidence & Attachments
- Reports
- Support
- Settings

### Permission flags

| Flag | Controls access to |
|------|-------------------|
| `canView` | General read access |
| `canEdit` | Create and update operations |
| `canManageUsers` | Team and membership management |
| `canDeleteOrganization` | Organization deletion |
| `canShareData` | Cross-agency data sharing |
| `canViewRegulatory` | Regulatory and compliance modules |
| `canViewCommercial` | Production and commercial modules |
| `canViewFinance` | Financial data layers |
| `canViewTechnical` | Technical support data |

### Role-specific navigation

Navigation is resolved dynamically from:

1. **Module registry** — For ministry admin and inspector profiles  
2. **Database (`role_navigation` table)** — For other roles (e.g., sourcing manager, finance officer)  
3. **Fallback menus** — When no role-specific configuration exists  

Special role menus include:

- **Sourcing manager (Hassad):** Supply Overview as primary landing page  
- **Unassigned users:** Live Map, Support, Settings only  
- **Normal User (@growa.ai):** Live Map, RSS Feed, Data Analytics  

Intelligence modules (Data Analytics, Water Intelligence, Energy Intelligence, Weather) are injected into most role menus automatically.

---

## 5. Dashboard and Workspace Layout

### Main layout

The dashboard uses a persistent layout with:

- **Top header** — Organization context, language toggle, user menu, View As selector (Growa admins)
- **Sidebar navigation** — Role-aware primary and secondary menu items
- **Main content area** — Map-centric or module workspace panels

### Workspace modes

| Mode | Behavior |
|------|----------|
| **Full map** | Satellite map fills the viewport (default for map modules) |
| **Slide-from-left panel** | Map shifts right; module panel occupies 75% width on the left (used for intelligence workspaces) |
| **Module workspace** | Structured placeholder or seed content for registry modules without dedicated UI |

### Map integration

Most intelligence workspaces link back to the Live Map. Users can:

- Click a producer or crop to navigate to its map location
- Filter the map by crop type
- Set zoom level via URL parameters (`pointId`, `crop`, `zoom`, `focus`)

---

## 6. Core Modules and Functions

### 6.1 Live Map

**Route:** `/dashboard?module=live-map` (also `/dashboard` default)

**Purpose:** Primary spatial decision surface for all operational roles.

**Functions:**
- Display Qatar-centered satellite map (Leaflet)
- Show map markers for farms, facilities, sensors, and custom points
- Draw and manage custom polygons (vertex, rectangle, circle methods)
- Filter and focus on specific points or crops via URL parameters
- Zoom controls and fly-to navigation
- Persist custom map points and polygons via API
- Integrate weather grid overlay when Weather module is active

**Who can access:** All authenticated users with `canView` permission; available to government, farm company, and unassigned users.

---

### 6.2 Weather

**Route:** `/dashboard?module=weather`

**Purpose:** Qatar-wide weather, solar, and agronomic intelligence on a 10 km grid.

**Functions:**
- Display a 10 km weather grid covering Qatar with selectable cells
- Fetch current weather readings by grid cell coordinates
- Show metrics across four categories:
  - **Light** — Cloudiness, diffuse/direct/global solar irradiance
  - **Environment** — Temperature, humidity, vapor pressure, fungal risk
  - **Wind** — Speed, direction, gusts
  - **Agronomy** — Crop-specific risk indicators and growing conditions
- View historical weather trends for a selected grid point
- Sync grid selection with the map (click a grid cell on the map to load its data)
- Refresh readings on demand

**API dependencies:**
- `GET /api/weather/by-coordinates`
- `GET /api/weather/history/by-coordinates`
- `GET /api/weather/grid`

---

### 6.3 Water Intelligence

**Route:** `/dashboard?module=water-intelligence`

**Purpose:** Monitor water consumption efficiency across crops and producers.

**Functions:**
- Aggregate water use (m³) and production (tons) by crop type
- Rank producers by water efficiency and resource intensity
- Display KPIs: total water, average water per ton, irrigation pressure
- Show crop-level water leader tables (highest intensity crops)
- Navigate from analytics rows to map locations
- Run Growa AI analysis on current water data

**Data source:** Farm crop insights API (`/api/operations/farm-crop-insights`) combined with custom map point polygons.

---

### 6.4 Energy Intelligence

**Route:** `/dashboard?module=energy-intelligence`

**Purpose:** Track energy consumption patterns across agricultural production.

**Functions:**
- Aggregate energy use (kWh) by crop and producer
- Calculate energy intensity per ton of production
- Rank producers by energy efficiency scores
- Display headline KPIs for total energy and average intensity
- Navigate to map locations from producer rankings
- Run Growa AI analysis on current energy data

---

### 6.5 Data Analytics

**Route:** `/dashboard?module=data-analytics`

**Purpose:** Cross-resource analytics combining production, water, and energy metrics.

**Functions:**
- Unified view of crop aggregates (production, water, energy, polygon scores)
- Producer efficiency rankings with resource intensity scores
- KPI cards for totals and averages across the organization
- Crop and producer tables with map navigation
- Growa AI briefing panel with suggested analysis prompts

---

### 6.6 RSS Feed

**Route:** `/dashboard?module=rss-feed`

**Purpose:** Curated external news and information feed alongside the operational map.

**Functions:**
- Display RSS feed content in a slide panel over the map
- Provide contextual awareness of external agricultural and policy news

---

### 6.7 Supply Overview

**Route:** `/dashboard/supply-overview`

**Purpose:** Supply chain visibility for sourcing and procurement roles (primarily Hassad Food).

**Functions:**
- KPI cards:
  - Available contract volume (tons)
  - In-transit volume (tons)
  - At-risk deliveries count
  - Average lead time (days)
- Supply flow table with origin, destination, commodity, status, and ETA
- Status indicators: on-track, watch, risk
- Recommended actions list for supply chain operators

**Who can access:** Primarily `sourcing_manager` role (Hassad supply chain).

---

### 6.8 National Overview

**Route:** `/dashboard?module=national-overview`

**Purpose:** Sovereign executive situational awareness for ministry leadership.

**Functions (designed):**
- Executive summary with national priorities
- National KPIs and risk hotspots
- Program status tracking
- Recent critical changes feed

**Submenu sections:** Executive Summary, Today's Priorities, National KPIs, Risk Hotspots, Program Status, Recent Critical Changes.

**Status:** Module workspace with structured placeholder content; full data integration pending.

---

### 6.9 Inspection Dashboard

**Route:** `/dashboard?module=inspection-dashboard`

**Purpose:** Inspector workload management and queue prioritization.

**Functions (designed):**
- Personal inspection queue
- Due-this-week items
- High-priority cases
- Assigned regions
- Open findings and completion status

**Who can access:** Ministry inspector profile.

---

### 6.10 Monitoring

**Route:** `/dashboard?module=monitoring`

**Purpose:** High-level environmental and data health signals for national operations.

**Functions (designed):**
- Environmental summary
- Water summary
- Weather risk overview
- Telemetry KPI overview
- Monitoring trends and data coverage metrics

---

### 6.11 Alerts & Risks / Alerts & Incidents

**Route:** `/dashboard?module=alerts-center`

**Purpose:** Coordinate triage, escalation, and closure of operational and compliance risk events.

**Functions (designed):**
- Alert center stream
- Critical incidents
- Risk hotspots
- Escalations and open investigations
- Resolved vs open trends

Inspector view relabels this module as **Alerts & Incidents** with compliance-focused submenus.

---

### 6.12 Compliance & Inspections

**Route:** `/dashboard?module=compliance-inspections`

**Purpose:** Track compliance posture, inspection planning, and regulatory execution.

**Functions (designed):**
- Inspection plans
- Non-conformity pipeline
- Corrective actions tracking
- Compliance score trends
- Regulatory report generation

---

### 6.13 Production & Harvest

**Route:** `/dashboard?module=production-harvest`

**Purpose:** Assess production readiness and harvest risk for food security planning.

**Functions (designed):**
- Production outlook and harvest forecast
- Regional readiness assessment
- Delayed zones identification
- Crop portfolio overview
- Supply risk signals

---

### 6.14 Compliance Cases

**Route:** `/dashboard?module=compliance-cases`

**Purpose:** End-to-end lifecycle management of compliance cases.

**Functions (designed):**
- Case queue by state (open, in review, awaiting evidence, closed, escalated)
- Evidence completeness tracking
- Case stage transitions and escalation

---

### 6.15 Non-Conformities

**Route:** `/dashboard?module=non-conformities`

**Purpose:** Track severity, recurrence, and regional spread of non-conformities.

**Functions (designed):**
- Open non-conformities by severity
- Geographic and farm-level grouping
- Repeat offender identification

---

### 6.16 Corrective Actions

**Route:** `/dashboard?module=corrective-actions`

**Purpose:** Monitor corrective action execution and verification closure.

**Functions (designed):**
- Open, overdue, pending verification, and closed action queues
- Verification workflow tracking

---

### 6.17 Farms & Sites

**Route:** `/dashboard/farms` and `/dashboard?module=farms-sites`

**Purpose:** Institutional registry of farms, sites, greenhouses, and production units.

**Functions:**
- List farms for the current organization (data table)
- View farm metadata (bilingual names, location, type, size, status)
- API-backed CRUD for farm records
- Navigate to farm locations on the map

**Farm types:** Crop, Livestock, Aquaculture  
**Farm statuses:** Active, Inactive, Maintenance

**Status:** List view implemented; create/edit/delete UI partially pending.

---

### 6.18 Evidence & Attachments

**Route:** `/dashboard?module=evidence-attachments`

**Purpose:** Manage inspection evidence lifecycle for traceable compliance decisions.

**Functions (designed):**
- Media uploads and evidence library
- Case attachments
- Missing evidence tracking
- Signed reports management

---

### 6.19 Inter-Agency Collaboration

**Route:** `/dashboard?module=inter-agency-collaboration`

**Purpose:** Secure case and data exchange across sovereign partner agencies.

**Functions (designed):**
- Shared cases and data requests
- Pending approvals workflow
- Cross-agency view management
- Visibility rules configuration
- Collaboration audit log

**Requires:** `canShareData` permission.

---

### 6.20 Programs & Policy

**Route:** `/dashboard?module=programs-policy`

**Purpose:** Track public programs and policy implementation by region.

**Functions (designed):**
- Public program enrollment status
- Program exceptions and incentive monitoring
- Regional coverage and policy performance metrics

---

### 6.21 Reports & Analytics

**Route:** `/dashboard?module=reports-center`

**Purpose:** Institutional reporting for executive and regulatory stakeholders.

**Functions (designed):**
- Executive, compliance, water-use, production, and program report packages
- Export center for scheduled and on-demand downloads

Inspector view provides inspection-specific report submenus.

---

### 6.22 Production Cycles

**Route:** `/dashboard/cycles`

**Purpose:** Track growing and breeding cycles across farm operations.

**Status:** Placeholder page — UI and data model defined, implementation pending.

---

### 6.23 Inventory

**Route:** `/dashboard/inventory`

**Purpose:** Manage agricultural inputs and resources.

**Status:** Placeholder page — UI and data model defined, implementation pending.

---

### 6.24 Analytics

**Route:** `/dashboard/analytics`

**Purpose:** Organization-level analytics dashboard.

**Status:** Placeholder page — planned for farm statistics and operational KPIs.

---

### 6.25 Support

**Route:** `/dashboard/support`

**Purpose:** Institutional support workflows and help channels.

**Functions (designed):**
- Help center and knowledge base
- Support ticket intake
- Contact support channels

**Who can access:** All authenticated users.

---

### 6.26 Settings

**Route:** `/dashboard/settings`

**Purpose:** Workspace configuration and operating preferences.

**Functions:**
- User and workspace preferences
- Notification rules
- Language and region settings
- Access preferences

**Sub-routes:**

| Route | Function |
|-------|----------|
| `/dashboard/settings/organizations` | Organization management (admin) |
| `/dashboard/settings/data-sharing` | Cross-organization data sharing rules (government orgs) |

---

### 6.27 Team Management

**Route:** `/dashboard/team`

**Purpose:** Manage organization members and role assignments.

**Functions:**
- List team members with roles
- Update member roles (admin/super_admin only)
- Remove members from organization
- Role icons and color-coded badges

**Requires:** Admin or super_admin role for management actions.

---

## 7. Growa AI Assistant

**Endpoint:** `POST /api/ai/growa/analyze`

The Growa Assistant is an AI-powered government briefing tool integrated into intelligence workspaces (Data Analytics, Water Intelligence, Energy Intelligence).

### How it works

1. The workspace loads operational data (crop aggregates, producer rankings, KPIs).
2. A structured **operational digest** is built from live dashboard data.
3. The user selects a suggested analysis prompt or custom question.
4. The request is sent to the Gemini model with strict grounding rules.
5. The AI returns a structured briefing with these sections:
   - Executive Summary
   - Evidence From Current Data
   - Risk Signals and Outliers
   - Recommended Government Actions
   - Monitoring KPIs and Data Gaps

### Grounding rules

- The AI must cite exact numbers from the operational digest.
- It must name specific crops and producers from the data.
- It cannot invent metrics unsupported by the digest.
- When data is missing or inconsistent, it must state limitations explicitly.

### Configuration

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` | API authentication |
| `GEMINI_MODEL` | Model selection (default: `gemini-3.5-flash`) |

---

## 8. Operations Management

### Farms API

| Method | Route | Function |
|--------|-------|----------|
| GET | `/api/operations/farms` | List farms for user's organizations |
| POST | `/api/operations/farms` | Create a new farm |
| GET | `/api/operations/farms/[id]` | Get farm details |
| PUT | `/api/operations/farms/[id]` | Update farm |
| DELETE | `/api/operations/farms/[id]` | Delete farm |

All routes require authentication and enforce RLS policies.

### Crop and map data API

| Method | Route | Function |
|--------|-------|----------|
| GET | `/api/operations/crop-types` | List available crop types |
| GET | `/api/operations/farm-crop-insights` | Production, water, and energy insights by map point |
| GET/POST | `/api/operations/custom-map-points` | Manage custom map markers |
| GET/POST | `/api/operations/custom-point-polygons` | Manage polygon areas on map points |

### Data domains (planned schema)

The operations data model covers:

- **Crop types** — Vegetables, fruits, grains, legumes, fodder, herbs, date palms
- **Livestock types** — Cattle, sheep, goats, camels, poultry, bees
- **Aquaculture species** — Fish, shrimp, and other marine species
- **Production cycles** — Growing and breeding cycle tracking
- **Inventory** — Inputs and resource management
- **Sensors and telemetry** — IoT data integration (future)

---

## 9. Data Sharing and Governance

### Cross-organization data sharing

**Route:** `/dashboard/settings/data-sharing`

**Functions:**
- View active data sharing agreements between organizations
- Create new sharing rules (government organizations only)
- Remove existing sharing agreements
- Select shareable organizations based on organization type

### Shared data layers

| Layer | Content |
|-------|---------|
| `regulatory` | Compliance, inspections, alerts |
| `commercial` | Production, harvest, supply data |
| `finance` | Financial and contract data |
| `technical_support` | Technical assistance records |

### Visibility levels

| Level | Meaning |
|-------|---------|
| `FULL` | Complete data access |
| `SUMMARY` | Aggregated/summary data only |
| `APPROVAL` | Access requires approval workflow |
| `NO` | No access to this layer |

---

## 10. Internationalization

### Supported languages

| Language | Code | Direction |
|----------|------|-----------|
| English | `en` | LTR (default) |
| Arabic | `ar` | RTL |

### Functions

- Language toggle in the user menu
- Automatic RTL/LTR layout switching
- Bilingual farm names and organization labels
- Arabic sidebar menu labels for all navigation items
- Translation keys organized by feature domain in `lib/i18n/locales/`

---

## 11. API Endpoints

### Authentication

Handled by Supabase Auth (no custom auth API routes).

### Operations

```
GET/POST  /api/operations/farms
GET/PUT/DELETE  /api/operations/farms/[id]
GET       /api/operations/crop-types
GET       /api/operations/farm-crop-insights
GET/POST  /api/operations/custom-map-points
GET/POST  /api/operations/custom-point-polygons
```

### Weather

```
GET  /api/weather/by-coordinates?lat=&lng=&requested_at=
GET  /api/weather/history/by-coordinates?lat=&lng=&from=&to=
GET  /api/weather/grid
```

### AI

```
POST  /api/ai/growa/analyze
Body: { module, prompt, context }
```

---

## 12. Security Model

### Row Level Security (RLS)

All application tables have RLS enabled. Policies enforce:

- Users can only read/write data within their organization scope
- Geographic and object scope assignments further restrict access
- Cross-organization access requires explicit sharing agreements

### Session security

- HTTP-only secure cookies
- JWT with short expiry (1 hour)
- Refresh token rotation
- Email verification gate before data access

### Server-side responsibilities

- Permission checks on all API routes
- Sensitive auth operations never exposed to client
- Organization context validated on every data request

---

## 13. Implementation Status Summary

| Area | Status |
|------|--------|
| Authentication (sign-in, sign-up, password reset) | ✅ Implemented |
| Multi-tenancy and RLS | ✅ Implemented |
| Dashboard layout and navigation | ✅ Implemented |
| Live Map with custom points/polygons | ✅ Implemented |
| Weather intelligence (grid + history) | ✅ Implemented |
| Water / Energy / Data Analytics workspaces | ✅ Implemented |
| Growa AI Assistant | ✅ Implemented |
| Supply Overview (Hassad) | ✅ Implemented |
| Farms list and API | ✅ Implemented |
| Team management | ✅ Implemented |
| Data sharing settings | ✅ Implemented |
| Role-based module registry (ministry) | ✅ Implemented |
| View As impersonation (@growa.ai) | ✅ Implemented |
| i18n (English/Arabic) | ✅ Implemented |
| Farm create/edit/delete UI | ⏳ Partial (API ready) |
| Production cycles | ⏳ Placeholder |
| Inventory | ⏳ Placeholder |
| Analytics page | ⏳ Placeholder |
| Ministry module workspaces (compliance, alerts, etc.) | ⏳ Structured placeholders |
| Audit logging | ⏳ Planned |
| SSO integration | ⏳ Planned |
| Mobile app | ⏳ Planned |

---

## Related Documentation

- [Platform Model](./PLATFORM_MODEL.md) — Deployment and organization hierarchy
- [Role Permissions](./ROLE_PERMISSIONS.md) — Detailed permission architecture
- [Auth Strategy](./AUTH_STRATEGY.md) — Authentication flows and invitation model
- [RLS Strategy](./RLS_STRATEGY.md) — Database security policies
- [Data Model: Operations](./DATA_MODEL_OPERATIONS.md) — Operational entity schemas
- [Implementation Status](./IMPLEMENTATION_STATUS.md) — Development progress tracker

---

**Growa Qatar** — Sovereign Agricultural Operations Platform  
Proprietary — Ministry of Social Development & Family, Qatar
