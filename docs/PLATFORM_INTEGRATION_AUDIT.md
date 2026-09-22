# Platform Integration Audit — Growa Qatar

**Generated:** September 2026  
**Purpose:** Phase 0 architectural audit for National Watchtower integration program.

---

## Executive Summary

Growa Qatar has **7 fully implemented intelligence/operations modules**, **14 ministry placeholder shells**, and **5 dedicated functional pages**. The platform already has strong foundations: map-centric routing, BFF API proxies, role-based navigation, deep-linking, and Growa AI in four workspaces. The primary gap is **cross-module coherence** — modules operate as capable silos without a unified situational-awareness layer.

---

## Module Inventory

### Fully Implemented Modules

| Module | Route | Component | APIs | Tables | Data | Deep Link | AI | Map |
|--------|-------|-----------|------|--------|------|-----------|----|----|
| Live Map | `?module=live-map` | `satellite-map.tsx` | `/api/operations/*` | farms, custom_map_points, polygons | Live + user RLS | ✅ farmId, pointId, crop, zoom | ❌ | ✅ core |
| Weather | `?module=weather` | `weather-workspace.tsx` | `/api/weather/*` | — (external API) | Live | ✅ weatherLat/Lng/GridId | ❌ | ✅ grid overlay |
| Harvest | `?module=harvest` | `harvest-workspace.tsx` | `/api/harvest/*` | — (Harvest API) | Live/Demo | ✅ parcelId, harvest* params | ✅ Growa | ✅ fields/raster |
| Data Analytics | `?module=data-analytics` | `data-analytics-workspace.tsx` | operations + AI | farm_crop_insights, polygons | Live | ✅ via useMapNavigation | ✅ Growa | ✅ 25% map |
| Water Intelligence | `?module=water-intelligence` | `water-intelligence-workspace.tsx` | operations + AI | farm_crop_insights | Live | ✅ crop/producer focus | ✅ Growa | ✅ 25% map |
| Energy Intelligence | `?module=energy-intelligence` | `energy-intelligence-workspace.tsx` | operations + AI | farm_crop_insights | Live | ✅ crop/producer focus | ✅ Growa | ✅ 25% map |
| RSS Feed | `?module=rss-feed` | `rss-feed-workspace.tsx` | `/api/rss/feeds` | — (external feeds) | Live | ❌ | ❌ | ✅ 25% map |
| **National Watchtower** | `?module=watchtower` | `watchtower-workspace.tsx` | `/api/watchtower/summary` | Aggregated | Live/Demo/Partial | ✅ signalId, timeframe | 🔜 Phase 13 | 🔜 Phase 7 |
| Supply Overview | `/dashboard/supply-overview` | `supply-overview/page.tsx` | Supabase direct | supply_* tables | Live (seed) | ❌ | ❌ | ❌ |
| Farms | `/dashboard/farms` | `farms/page.tsx` | `/api/operations/farms` | farms | Live | ❌ | ❌ | ❌ |
| Settings | `/dashboard/settings` | settings pages | Supabase | profiles, orgs | Live | ❌ | ❌ | ❌ |

### Ministry Placeholder Modules (ModuleWorkspace shells)

| Module | Route | Status | Cross-nav |
|--------|-------|--------|-----------|
| national-overview | `?module=national-overview` | **Migrated → Watchtower** | Alias preserved |
| inspection-dashboard | `?module=inspection-dashboard` | Placeholder | ❌ |
| monitoring | `?module=monitoring` | Placeholder | ❌ |
| alerts-center | `?module=alerts-center` | Placeholder | ❌ |
| compliance-* | various | Placeholder | ❌ |
| farms-sites | `?module=farms-sites` | Placeholder (real farms at `/dashboard/farms`) | ❌ |

### Placeholder Pages

| Route | Status | Severity |
|-------|--------|----------|
| `/dashboard/analytics` | "Coming soon" | MEDIUM |
| `/dashboard/inventory` | "Coming soon" | LOW |
| `/dashboard/cycles` | "Coming soon" | MEDIUM |

---

## Missing Connections (Classified)

### CRITICAL

| Finding | Impact |
|---------|--------|
| No unified situational-awareness entry point | Ministry users land on placeholder national-overview | **ADDRESSED:** Watchtower implemented |
| Intelligence modules fetch same operations data independently | 3× duplicate API calls per session | **PARTIAL:** Server aggregation in Watchtower API |
| No cross-module context preservation beyond URL params | Investigation context lost on navigation | **ADDRESSED:** Operational context + navigation utilities |

### HIGH

| Finding | Impact |
|---------|--------|
| Duplicate normalization logic (client vs server) | Risk of inconsistent KPIs | **ADDRESSED:** `lib/operations/intelligence-normalize.ts` |
| No deterministic signal engine | Reliance on manual review | **ADDRESSED:** `lib/watchtower/signals-engine.ts` |
| Ministry placeholders clickable but non-functional | User confusion | **DEFERRED:** Mark upcoming in Phase 15 |
| `data_sharing` table referenced but not migrated | Runtime errors on data-sharing page | Existing — document only |
| Farms without GPS cannot fly-to | Broken map navigation from search | Existing — known limitation |

### MEDIUM

| Finding | Impact |
|---------|--------|
| No shared metric definitions document | KPI drift across modules | **ADDRESSED:** `docs/METRIC_DEFINITIONS.md` |
| Growa AI limited to 4 modules | No platform-level briefing | Phase 13 |
| No alert lifecycle persistence | Cannot track signal → action | Phase 14 |
| Supply not linked to production intelligence | Food security chain broken | Phase 12 partial |
| Sidebar flat list for ministry roles | Poor information architecture | **ADDRESSED:** Section grouping |

### LOW

| Finding | Impact |
|---------|--------|
| `supabase/types/database.ts` placeholder | No generated types | Existing |
| `satellite-map.tsx` ~3000 lines | Maintainability | Future refactor |
| No component test infrastructure | Regression risk | **ADDRESSED:** Vitest added |

---

## Data Source Matrix

| Source | Mode | Demo Fallback | Auth | Used By |
|--------|------|-----------------|------|---------|
| Supabase operations | Live | No | Session + RLS | Map, intelligence, Watchtower |
| Harvest API | Live/Demo | Yes (`X-Harvest-Demo`) | Session | Harvest, Watchtower |
| Weather API | Live | No (500 if missing) | None (BFF) | Weather, Watchtower |
| RSS feeds | Live | No | None | RSS, Watchtower (health only) |
| Gemini AI | Live | No (503 if missing) | Session | Growa panels |
| Supply snapshots | Live (seed) | No | Session + RLS | Supply overview, Watchtower |

---

## Recommended Integration Sequence

See `docs/WATCHTOWER_IMPLEMENTATION_PLAN.md` for live status.
