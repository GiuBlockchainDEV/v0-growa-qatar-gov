# Current Product Reality — Growa Qatar

**Generated:** September 2026  
**Purpose:** Honest comparison of documented intent vs implemented codebase.  
**Rule:** The codebase is the source of truth; historical docs may be stale.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **IMPLEMENTED** | Functional UI + backend, usable in production/demo |
| **PARTIALLY IMPLEMENTED** | Real code exists but incomplete integration or data |
| **PLACEHOLDER** | Navigation/routing exists; shell UI without real workflow |
| **MISSING** | Referenced but no implementation |
| **DUPLICATED** | Same capability implemented in multiple places |
| **INCONSISTENT** | Works but with conflicting models, KPIs, or UX |

---

## Summary matrix

| Area | Documented | Reality | Status |
|------|------------|---------|--------|
| Auth | Supabase Auth, login, signup | `app/auth/*`, `features/auth-access/` | **IMPLEMENTED** |
| Roles | Role templates, scope, permissions | `user_organization_members.role`, hooks, registry | **PARTIALLY IMPLEMENTED** |
| Organizations | Multi-org hierarchy | `organizations`, settings, RLS | **IMPLEMENTED** |
| Farms | National farm registry | List page + map CRUD; no unified workspace | **PARTIALLY IMPLEMENTED** |
| Operations | Production units, cycles, inventory | DB tables exist; UI mostly placeholder | **PLACEHOLDER** |
| Watchtower | National situational awareness | Command center + signals API | **IMPLEMENTED** |
| Map | National spatial backbone | `satellite-map.tsx` (~3k lines) | **IMPLEMENTED** |
| Satellite / Harvest | NDVI, raster, forecast | Harvest BFF + workspace | **IMPLEMENTED** |
| Weather | Grid + point intelligence | Weather workspace + BFF | **IMPLEMENTED** |
| Water | Resource intelligence | Workspace + `farm_crop_insights` | **IMPLEMENTED** |
| Energy | Resource intelligence | Workspace + insights data | **IMPLEMENTED** |
| Analytics | Cross-domain analytics | `data-analytics` workspace live; `/dashboard/analytics` placeholder | **INCONSISTENT** |
| Supply | Food security position | Supply overview + seed data | **PARTIALLY IMPLEMENTED** |
| Alerts | Operational alert lifecycle | `operational_alerts` + Alerts Center | **PARTIALLY IMPLEMENTED** |
| Inspections | Field inspection workflow | Module shell only | **PLACEHOLDER** |
| Compliance | Cases, NC, corrective actions | Module shells only | **PLACEHOLDER** |
| Collaboration | Inter-agency workflows | Module shell only | **PLACEHOLDER** |
| Programs | Policy monitoring | Module shell only | **PLACEHOLDER** |
| Reports | Executive reporting | Module shell + placeholder page | **PLACEHOLDER** |
| AI | Growa assistant | 5-module Gemini chat; no orchestrator | **PARTIALLY IMPLEMENTED** |

---

## Auth

| Aspect | Status | Evidence |
|--------|--------|----------|
| Login / signup | IMPLEMENTED | `app/auth/login`, `sign-up`, `callback` |
| Session refresh | IMPLEMENTED | `proxy.ts`, Supabase middleware |
| Password reset | MISSING | i18n keys only |
| MFA | DOCUMENTED in schema | Not exposed in UI |

---

## Roles & permissions

| Aspect | Status | Evidence |
|--------|--------|----------|
| Org membership roles | IMPLEMENTED | `user_organization_members` |
| Ministry role profiles | PARTIALLY IMPLEMENTED | `module-registry.ts`, `platform-navigation.ts` |
| Geographic scope | DOCUMENTED | `scope_assignments` in legacy schema; weak UI exposure |
| Object scope | DOCUMENTED | Not enforced in frontend navigation |
| Impersonation | PARTIALLY IMPLEMENTED | RPC + `user_impersonation_state`; `ViewAsSelector` unwired |
| Role-specific workspaces | PARTIALLY IMPLEMENTED | Different landings; same shell for most roles |

---

## Organizations

| Aspect | Status | Evidence |
|--------|--------|----------|
| Multi-tenant orgs | IMPLEMENTED | `organizations`, RLS |
| Org settings | IMPLEMENTED | `/dashboard/settings` |
| Org hierarchy view | IMPLEMENTED | `/dashboard/settings/organizations` |
| Department model | DOCUMENTED | `departments` table in legacy schema; no UI |
| Org switcher in shell | MISSING | `useOrganization` exists; header has no switcher |

---

## Farms & operations

| Aspect | Status | Evidence |
|--------|--------|----------|
| Farm list | IMPLEMENTED | `/dashboard/farms` |
| Farm on map | IMPLEMENTED | `custom_map_points`, polygons |
| Unified farm workspace | MISSING | `farm-intelligence-panel` only (compact) |
| Production units | PLACEHOLDER | DB `production_units`; no UI |
| Growing cycles | PLACEHOLDER | DB + `/dashboard/cycles` “coming soon” |
| Livestock / aquaculture | DOCUMENTED | DB tables; no UI |
| Inventory | PLACEHOLDER | DB + `/dashboard/inventory` “coming soon” |
| Farm activities | DOCUMENTED | DB `farm_activities`; no UI |

---

## Watchtower

| Aspect | Status | Evidence |
|--------|--------|----------|
| National landing (ministry) | IMPLEMENTED | `?module=watchtower` |
| Status strip | IMPLEMENTED | 5 domains |
| Priority signals | IMPLEMENTED | Deterministic engine |
| What Changed | IMPLEMENTED | `changes-engine.ts` |
| National map embed | PARTIALLY IMPLEMENTED | Panel exists; layer wiring incomplete |
| KPI summaries | IMPLEMENTED | Production, water, energy, climate, supply |
| Outlook | IMPLEMENTED | Honest insufficient-data states |
| AI executive brief | PARTIALLY IMPLEMENTED | Growa panel; not multi-agent |
| Food security position | PARTIALLY IMPLEMENTED | Supply chain panel |
| Active government actions | MISSING | No persisted action queue |

---

## Map

| Aspect | Status | Evidence |
|--------|--------|----------|
| Full-screen live map | IMPLEMENTED | `?module=live-map` |
| Deep linking | IMPLEMENTED | farmId, pointId, parcelId, crop, zoom |
| Layer registry | PARTIALLY IMPLEMENTED | `WATCHTOWER_MAP_LAYERS`; not all wired in map |
| 75/25 intelligence layout | IMPLEMENTED | SlideFromLeftWorkspace |
| Map as operational backbone | IMPLEMENTED | Core UX pattern |

---

## Intelligence modules

| Module | Status | Growa AI | Context banner |
|--------|--------|----------|----------------|
| Harvest / Satellite | IMPLEMENTED | Yes | Partial |
| Weather | IMPLEMENTED | No | No |
| Water | IMPLEMENTED | Yes | Yes |
| Energy | IMPLEMENTED | Yes | Yes |
| Data Analytics | IMPLEMENTED | Yes | Yes |
| RSS | IMPLEMENTED | No | No |

**INCONSISTENT:** Intelligence workspaces share `intelligence-workspace-ui` but do not yet follow the full investigation structure (Context → Condition → Changed → Analysis → Actions).

---

## Food security & supply

| Aspect | Status | Evidence |
|--------|--------|----------|
| Supply overview page | PARTIALLY IMPLEMENTED | Seed snapshots |
| Commodity workspace | MISSING | No per-commodity view |
| Production → harvest → supply chain | PARTIALLY IMPLEMENTED | Watchtower panel shows chain with gaps |
| Demand / coverage KPIs | MISSING | No demand data source |
| Domestic + external supply | PARTIALLY IMPLEMENTED | Flows table; weak farm linkage |

---

## Risk & response

| Layer | Status | Evidence |
|-------|--------|----------|
| Signals (computed) | IMPLEMENTED | Watchtower engine |
| Alerts (persisted) | PARTIALLY IMPLEMENTED | `operational_alerts`, basic lifecycle |
| Investigations | MISSING | No entity or UI |
| Inspections | PLACEHOLDER | `inspection-dashboard` shell |
| Compliance cases | PLACEHOLDER | Module shells |
| Corrective actions | PLACEHOLDER | Module shell |

**INCONSISTENT:** Spec defines signal → risk → alert → investigation hierarchy; current UI merges signal display and alert creation without investigation object.

---

## Governance & collaboration

| Aspect | Status |
|--------|--------|
| Inter-agency collaboration | PLACEHOLDER |
| Programs & policy | PLACEHOLDER |
| Reports center | PLACEHOLDER |
| Evidence attachments | PLACEHOLDER |
| Data sharing | PARTIALLY IMPLEMENTED (table may be missing) |
| Audit logs | PARTIALLY IMPLEMENTED (schema exists; limited UI) |

---

## AI

| Aspect | Status | Evidence |
|--------|--------|----------|
| Module chat (Growa) | IMPLEMENTED | Gemini via `/api/ai/growa/analyze` |
| Grounded context builders | IMPLEMENTED | Per-module digest builders |
| Specialist agents | MISSING | No agent types |
| Orchestrator | MISSING | No task planning |
| Mission Control UI | MISSING | No AI Operations area |
| Agent tools (permissioned) | MISSING | No tool layer |
| Proposed actions / HITL | MISSING | Alert create is manual only |
| Agent audit trail | MISSING | No `agent_tasks` table |
| Proactive scheduled reviews | MISSING | No scheduler |

---

## Application shell

| Aspect | Status | Evidence |
|--------|--------|----------|
| Sidebar sections | PARTIALLY IMPLEMENTED | 8 sections; missing AI Operations, Governance split |
| Top bar | PARTIALLY IMPLEMENTED | Search, role, language; no org/scope/timeframe/alerts count |
| Global context | PARTIALLY IMPLEMENTED | `OperationalContextProvider`; missing investigationId, commodityId |
| Visual redesign | PARTIALLY IMPLEMENTED | Watchtower dark command style; other pages mixed |
| RTL | PARTIALLY IMPLEMENTED | i18n infra; many hardcoded strings |

---

## Duplications & inconsistencies

| Issue | Locations |
|-------|-----------|
| Two `farms` table definitions | `003_create_farms.sql` vs `00009_operations_farms.sql` |
| Two analytics entry points | `?module=data-analytics` vs `/dashboard/analytics` |
| Two membership models | `memberships` (legacy) vs `user_organization_members` (active) |
| Farm entity fragmentation | `farms` table vs `custom_map_points` vs Harvest parcels |
| KPI calculation | Client intelligence hooks vs server watchtower aggregation (partially unified) |
| Navigation sources | Registry + platform-navigation + DB `role_navigation` |

---

## What works end-to-end today

1. Login → ministry landing on Watchtower  
2. Watchtower → signal → map focus → farm panel → Water/Harvest with context  
3. Live map → farm search → deep link  
4. Harvest field creation, raster, AI analysis  
5. Weather grid selection on map  
6. Signal → create alert (if migration applied)  
7. Supply overview read (seed data)  

## What does NOT work end-to-end

1. Inspection assignment → visit → finding → closure  
2. Investigation workflow from signal  
3. Commodity-centric food security analysis  
4. Multi-agent AI investigation  
5. Inter-agency data sharing approval flow  
6. Program effectiveness tracking  
7. Executive report generation  
8. Regional officer scoped Watchtower  

---

## Conclusion

The platform has **strong foundations** in map, harvest, weather, resource intelligence, and Watchtower aggregation, but the **product still behaves like connected modules** rather than a unified national operating environment. The largest gaps are: **role-differentiated workspaces**, **risk/investigation workflow**, **food security commodity layer**, **governance modules**, and **agentic AI operating model**.
