# NFII v2 — Baseline Audit

**Audit date:** 31 October 2026 (Asia/Qatar)  
**Branch:** `cursor/nfii-v2-baseline-audit-8604` (audit-only; no feature implementation)  
**Repository:** Growa-AI/NFII (`growa-qatar` package)  
**Stack observed:** Next.js 16.4.3, React 19.2.4, TypeScript 5.7.3, Supabase client, Vitest 3.2.4  

This document compares **documented intent** (`docs/CURRENT_PRODUCT_REALITY.md`, `docs/TARGET_PRODUCT_ARCHITECTURE.md`) with **what the codebase actually contains** after a full tree review of navigation, Watchtower, AI agents, dashboard workspaces, `app/api/`, and `supabase/migrations/`, plus automated baseline checks.

---

## 1. Executive summary

The codebase is a **mature multi-module national agriculture platform** with strong **Watchtower aggregation**, **map-centric UX**, **Harvest BFF**, **weather proxy APIs**, and **resource intelligence** (water/energy). Recent work has **partially closed gaps** called out in September 2026 docs: unified **navigation registry**, **investigations/inspections** APIs and workspaces, **agent missions** persistence, **commodity workspace**, and **farm workspace shell**—but several of these remain **simulated or schema-dependent** rather than full institutional workflows.

**Build health:** All baseline checks passed in this environment (see §2).  
**Largest structural risks:** duplicate/conflicting **database migration paths**, optional **service-role farm search bypassing RLS**, missing **`data_sharing` table** for UI hooks, and **target architecture items** (PlatformContextProvider, agent tool layer, HITL execution) still absent or stubbed.

---

## 2. Baseline check results

Environment: Node **v22.23.4**, clean `git` working tree, `npm ci` from lockfile.

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Install | `npm ci` | **PASS** | 508 packages; **22 npm audit findings** (17 moderate, 3 high, 2 critical), mostly transitive via `eslint` / `minimatch`; no fix applied in this audit |
| Lint | `npm run lint` | **PASS** (0 errors) | **27 warnings** (`no-explicit-any`, `react-hooks/exhaustive-deps`) |
| Unit tests | `npm test` | **PASS** | **21 files, 87 tests** |
| TypeScript | `npx tsc --noEmit` | **PASS** | No emitted errors |
| Production build | `npm run build` | **PASS** | Next.js 16 Turbopack; **38 app routes** including full Harvest and Watchtower API surface |

**Not run (environment / scope):** Supabase migration apply against a live project, E2E browser tests, Harvest external API integration smoke, Gemini/weather key validation (secrets not present in repo).

---

## 3. Architecture alignment vs target (v2.0)

| Target area (§2 TARGET doc) | Baseline reality | Gap severity |
|----------------------------|------------------|--------------|
| 7 product areas + Platform sidebar | **Implemented** in `lib/navigation/registry.ts` with EN/AR labels, role profiles, availability tags | Low — some `module-status.ts` descriptions disagree with registry (e.g. farms marked `live` in status vs `partial` in registry) |
| PlatformContext + `lib/platform/navigation.ts` | **Partial** — `PlatformContext` types/parsers in `lib/domain/platform-context.ts`; **no** `PlatformContextProvider`; **no** `lib/platform/navigation.ts` (only `commodity-catalog.ts`) | Medium |
| Intelligence investigation layout | **Partial** — `IntelligenceInvestigationLayout` used in commodity/water/energy; not uniform across all intelligence modules | Medium |
| Unified farm workspace tabs | **Partial** — `/dashboard/farms/[id]` exists; most non-overview tabs are **link-out placeholders** | Medium |
| Food security commodity route | **Partial** — `?module=commodities` workspace with catalog + Watchtower linkage; **no** `/dashboard/food-security/commodities/[id]` route | Medium |
| Risk: investigations entity | **Partial** — DB + API + UI CRUD; **no** full signal→investigation→inspection chain in UI | Medium |
| AI Operations / Mission Control | **Partial** — registry, orchestrator, missions API, UI; **simulated** agent execution (deterministic artifacts, no tool calls, no approval execution) | High |
| Governance modules | **Mostly upcoming** — `ModuleWorkspace` shell for un wired modules | High |
| Role-specific landings | **Not implemented** — all profiles land on Watchtower per `ROLE_LANDINGS` | Medium |

`docs/CURRENT_PRODUCT_REALITY.md` remains **directionally accurate** but **understates** newer AI/risk/commodity work and **overstates** some items as fully missing (e.g. specialist agent types now exist in `lib/ai/agents/registry.ts`).

---

## 4. Navigation (`lib/navigation/registry.ts`)

**Status: IMPLEMENTED (primary menu SSOT)**

- Eight product areas match target IA (Watchtower → Platform).
- Role filtering via `ROLE_NAV_KEYS` for `ministry_admin`, `ministry_inspector`, `hassad_supply`, `farm_operations`, `finance`, `default`.
- Availability: `live` | `partial` | `upcoming` per item.
- Tests: `lib/navigation/registry.test.ts` (8 tests passing).

**Residual duplication:** Comments reference removed/overlapping sources; no remaining imports of legacy `platform-navigation.ts` / `module-registry.ts` in TS (grep clean). Role navigation may still compose DB `role_navigation` via hooks (not fully audited in this pass).

**Inconsistencies:**

- Duplicate menu paths to Harvest (`harvest` under Operations and `production-harvest` under Intelligence).
- `ai-briefings` points to Watchtower URL, not a dedicated briefings module.
- `/dashboard/analytics` is **not** in registry; live analytics live at `?module=data-analytics`.

---

## 5. Watchtower (`lib/watchtower/`)

**Status: IMPLEMENTED (core national BFF logic)**

| Component | Role | Data character |
|-----------|------|----------------|
| `fetch-context-data.ts` | Loads Supabase + Harvest-related context | **Observed** where APIs/DB return data |
| `signals-engine.ts` | Rule-based signals (water, crop, supply, data quality, etc.) | **Derived** from observed inputs; deterministic |
| `changes-engine.ts` | “What changed” narratives | **Derived** |
| `build-summary.ts` | National KPIs, outlook, supply/production summaries | Mix of **observed**, **derived**, and **honest unknowns** when data thin |
| `source-health.ts` | Data quality / source availability | **Derived** |
| Unit tests | `signals-engine`, `signal-priority`, `production-metrics`, `map-layer-visibility` | Passing |

**API:** `GET /api/watchtower/summary` — auth required, session Supabase client, aggregates via `buildWatchtowerSummary`.

**Partial:** Map layer registry (`map-layers.ts`, `WATCHTOWER_MAP_LAYERS`) vs full wiring in `satellite-map.tsx` (~2900+ lines) — layers not all connected end-to-end.

**Missing vs target:** Persisted **government action queue**; regional scope filtering for officers.

---

## 6. Dashboard workspaces (`components/dashboard/`)

### Live / production-grade

| Module | Entry | Backend |
|--------|-------|---------|
| Watchtower | `?module=watchtower` | `/api/watchtower/summary` |
| National map | `?module=live-map` | Map + operations APIs |
| Harvest | `?module=harvest` | Extensive `/api/harvest/*` |
| Weather | `?module=weather` | `/api/weather/*` (requires external API key) |
| Water / Energy / Data analytics | respective `?module=` | Operations insights + client hooks |
| RSS | `?module=rss-feed` | `/api/rss/feeds` |
| Data health | `?module=data-health` | Watchtower summary subset |
| Alerts center | `?module=alerts-center` | `/api/alerts` (+ `operational_alerts` migration) |
| Farms list | `/dashboard/farms` | Supabase + `/api/operations/farms` |

### Partial (real code, incomplete workflow or data)

| Module | Notes |
|--------|-------|
| **Commodities** | `CommodityWorkspace` — static `COMMODITY_CATALOG`, aggregates from intelligence hooks + Watchtower; labels gaps (“Insufficient forecast linkage”) |
| **Investigations** | CRUD against `operational_investigations`; graceful `unavailable` if migration missing |
| **Inspections** | Full UI workflow stages; API `operational_inspections`; compliance module reuses same workspace |
| **AI Mission Control** | Missions persisted when `agent_missions` exists; **orchestrator simulates** specialist output text; **no approve/reject API** for proposed actions |
| **Supply overview** | Page + seed migrations (`00015_*`); treat as **seed/demo**, not verified national statistics |
| **Farm workspace** | Tabs for production/satellite/etc. are **navigation stubs** |
| **Settings → Data sharing** | UI + hooks query **`data_sharing` table — no migration in repo** |

### Upcoming / shell only

Routed via `ModuleWorkspace` when `module` query matches governance/upcoming keys: programs, inter-agency, reports, evidence, corrective actions, monitoring, forecast-resilience, etc.

### Inconsistent entry points

- `/dashboard/analytics` — **placeholder** “Coming soon”.
- `?module=data-analytics` — **live** workspace.

---

## 7. AI layer (`lib/ai/` + `app/api/ai/`)

| Capability | Status | Evidence |
|------------|--------|----------|
| Growa module chat (Gemini) | **IMPLEMENTED** | `/api/ai/growa/analyze`, auth + module allowlist + context size cap |
| Context builders | **IMPLEMENTED** | `build-*-growa-context.ts`, digests |
| Specialist agent registry | **IMPLEMENTED** | `lib/ai/agents/registry.ts` (12 agent types) |
| Orchestrator | **PARTIAL / SIMULATED** | `planMission` + `advanceMission` — template artifacts, fake `toolName` references, no server tools |
| Missions persistence | **PARTIAL** | `00029_agent_missions.sql`, `/api/ai/missions` |
| Permissioned tool layer | **MISSING** | No `get_farm`, `get_water_metrics`, etc. implementations |
| HITL action execution | **MISSING** | UI shows “Requires human approval”; no POST to create investigation/alert from proposal |
| LLM in orchestrator path | **MINIMAL** | Missions advance deterministically; Growa LLM separate path |
| Proactive scheduler | **MISSING** | — |

---

## 8. HTTP API surface (`app/api/`)

**36 route handlers** (build manifest), grouped:

- **Auth/session implied:** All audited routes use `createClient()` + `getUser()` except where noted.
- **Harvest:** 15+ routes — BFF to external Harvest service (env-dependent).
- **Operations:** farms, map points, polygons, crop types, farm-crop-insights, farm intelligence.
- **Watchtower, weather, RSS, alerts, investigations, inspections, AI.**

**Security finding — farm search service role:**

`app/api/operations/farms/route.ts` uses `SUPABASE_SERVICE_ROLE_KEY` when set for **GET list/search/detail**, after user auth. That **bypasses RLS** for read paths while still requiring a logged-in user. Risk: over-broad farm visibility if service role is enabled in production without additional filters.

**Other notes:**

- Hardcoded fallback Supabase URL in farms route if env missing (public project ref in source).
- Weather routes fail closed with `WEATHER_API_KEY_MISSING` when no key env.
- Growa returns 503 when `GEMINI_API_KEY` missing.

---

## 9. Database migrations (`supabase/migrations/`)

**34 SQL files** (excluding `.gitkeep`). Two **parallel numbering schemes**:

1. **Prefixed numeric:** `00001_*` … `00030_*` (operations + unified core + alerts + agents + inspections).
2. **Legacy unprefixed:** `001_create_organizations.sql` … `004_create_user_organization_members.sql`.

Lexicographic apply order runs **all `000xx` before `001`–`004`**, so legacy scripts often hit **already-created** objects — mitigated partly by `00017_unified_app_core_schema.sql` (idempotent patches).

### Conflicts and gaps

| Issue | Detail |
|-------|--------|
| **Duplicate `farms` DDL** | `00009_operations_farms.sql` (rich schema) vs `003_create_farms.sql` (simpler `public.farms`) — second `CREATE TABLE farms` **fails** on fresh apply unless one path skipped |
| **Duplicate migration version** | Two files named `00012_*` — ordering between them is **filename-dependent** only |
| **Missing sequence** | No `00021_*.sql` (jump 00020 → 00022) — likely intentional rename; document for operators |
| **Missing table for UI** | **`data_sharing`** referenced in `hooks/use-data-sharing.ts` — **no SQL migration** |
| **Seed vs national data** | `00005_seed_qatar_data.sql`, `00012_operations_seed_data.sql`, `00015_supply_overview_seed_data.sql` — **demo/seed**; must not be presented as live national statistics |
| **Newer risk/AI tables** | `00028_operational_alerts`, `00029_agent_missions` (+ `operational_investigations`), `00030_operational_inspections` — features degrade gracefully when not applied |

**Recommendation (future phase):** Single ordered migration chain, squash or guard legacy `001–004`, resolve dual `farms` model, add `data_sharing` or remove UI.

---

## 10. Authentication, RLS, and localization

| Item | Status |
|------|--------|
| Supabase Auth login/signup/callback | **IMPLEMENTED** |
| Middleware / session refresh | **IMPLEMENTED** (`proxy.ts` pattern) |
| RLS on core tables | **IMPLEMENTED** in migrations; recursion fixes in `00018`/`00019` |
| Password reset / MFA UI | **MISSING** / not exposed |
| EN/AR + RTL | **PARTIAL** — i18n infra + registry `labelAr`; many component strings still English-first |
| Impersonation | Schema/RPC referenced in docs; **ViewAsSelector unwired** (not re-verified in UI this audit) |

---

## 11. Dependency and supply-chain notes

- **npm audit:** 22 vulnerabilities reported at install time; predominantly **dev toolchain** (eslint ecosystem). Not remediated in audit branch.
- **Runtime deps:** Lean — Next, Supabase, Leaflet, Gemini SDK, markdown.
- **No broken install** — lockfile resolves cleanly.

---

## 12. Functionality matrix (audit snapshot)

Legend: **I** implemented · **P** partial · **S** simulated/stub · **M** missing

| Domain | I | P | S | M |
|--------|---|---|---|---|
| Auth & orgs | ✓ | roles/scope | | password reset, MFA UI |
| Watchtower & signals | ✓ | map layers | | action queue, regional scope |
| Map & spatial | ✓ | | | |
| Harvest / satellite | ✓ | env-dependent | | |
| Weather | ✓ | without API key | | |
| Water / energy / analytics | ✓ | layout standardization | | |
| Supply & commodities | | ✓ | seed supply | demand KPIs, dedicated commodity routes |
| Alerts | | ✓ | | full lifecycle vs spec |
| Investigations & inspections | | ✓ | | end-to-end with signals |
| Governance | | | | programs, reports, evidence |
| AI Growa chat | ✓ | | | |
| AI agents / mission control | | ✓ | orchestrator | tools, HITL execute, scheduler |
| Data sharing platform | | UI only | | DB table |
| Farm unified workspace | | shell | | tab content |
| Platform context provider | | types only | | provider + navigation helper |

---

## 13. Verified end-to-end paths (code review)

**Supported in code (subject to env + migrations):**

1. Authenticated Watchtower summary → signals → deep link to map/modules.  
2. Intelligence modules with map panel layout (weather/harvest/water/energy/analytics).  
3. Signal-scoped investigation create (if `operational_investigations` exists).  
4. Inspection queue CRUD (if `operational_inspections` exists).  
5. AI mission create → deterministic completion → display proposals (no execution).  
6. Growa analyze per module with grounded context (if `GEMINI_API_KEY` set).

**Not supported:**

1. Approve AI proposal → create alert/investigation automatically.  
2. Inspection → compliance case → corrective action closure.  
3. Commodity-centric national demand/coverage with authoritative demand feed.  
4. Scoped Watchtower for regional officer geography.  
5. Data sharing agreement workflow (missing table).  

---

## 14. Stale documentation to refresh (next doc pass)

- `docs/CURRENT_PRODUCT_REALITY.md` — AI agents, investigations, inspections, commodities, navigation registry.  
- `docs/TARGET_PRODUCT_ARCHITECTURE.md` — PlatformContextProvider and `lib/platform/navigation.ts` not built as specified.  

---

## 15. Audit scope boundary

This phase **did not** implement features, apply migrations to any hosted Supabase project, or deploy. Baseline checks prove **compile/test integrity** of the current tree, not operational correctness against production Qatar datasets.

**Next recommended phase (when authorized):** migration hygiene, remove service-role farm reads or enforce org filters, add `data_sharing` schema or disable UI, wire HITL and agent tools, align farm entity models.

---

*Generated by NFII v2 Phase 1 audit on branch `cursor/nfii-v2-baseline-audit-8604`.*
