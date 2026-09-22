# Watchtower Implementation Plan

Live work log for the National Agricultural Watchtower program.

---

## DONE

| Task | Files | Notes |
|------|-------|-------|
| Phase 0: Platform audit | `docs/PLATFORM_INTEGRATION_AUDIT.md` | Module inventory, gaps classified |
| Shared domain types | `lib/domain/types.ts`, `lib/domain/entities.ts` | Signals, status, metrics, entity mapping |
| Operational context | `lib/domain/operational-context.ts`, `contexts/operational-context-provider.tsx` | URL-synced global context |
| Timeframe utilities | `lib/domain/timeframes.ts` | NOW/24H/7D/30D/SEASON |
| Cross-module navigation | `lib/dashboard/operational-navigation.ts` | navigateToFarm/Signal/Module |
| Platform navigation IA | `lib/navigation/platform-navigation.ts`, `lib/navigation/sections.ts` | Role-based layered sidebar |
| Module status registry | `lib/navigation/module-status.ts` | Live / partial / upcoming |
| Signal rules + engines | `lib/watchtower/*` | Deterministic signals, changes, source health |
| Watchtower API | `app/api/watchtower/summary/route.ts` | BFF aggregation |
| Watchtower command center UI | `components/dashboard/watchtower-workspace.tsx`, `watchtower/*` | Map + signals grid, KPIs, outlook, AI |
| National map panel | `components/dashboard/watchtower/national-map-panel.tsx` | Layer toggles + embedded map |
| Farm intelligence object | `app/api/operations/farms/[id]/intelligence/route.ts`, `farm-intelligence-panel.tsx` | Unified farm context |
| Alerts schema + API | `supabase/migrations/00028_operational_alerts.sql`, `app/api/alerts/*` | Lifecycle persistence |
| Alerts Center workspace | `components/dashboard/alerts-center-workspace.tsx` | Status workflow UI |
| Honest placeholder modules | `components/dashboard/module-workspace.tsx` | No fake KPIs |
| Operational context banner | `components/dashboard/operational-context-banner.tsx` | Intelligence module context |
| Role landing pages | `contexts/role-navigation-context.tsx` | Ministry → Watchtower, etc. |
| i18n (EN + AR) | `lib/i18n/locales/en.ts`, `ar.ts` | Watchtower, alerts, context, nav sections |
| Unit tests | `lib/**/*.test.ts` | Signals, timeframes, navigation, module-status |
| pnpm lockfile sync | `pnpm-lock.yaml` | Vercel CI fix |

---

## IN PROGRESS

| Task | Files | Remaining |
|------|-------|-----------|
| Map layer wiring | `satellite-map.tsx`, `national-map-panel.tsx` | Full layer visibility in map renderer |
| Supply ↔ production linkage | `supply-chain-panel.tsx`, supply overview | Commodity demand/target when data exists |

---

## NEXT

| Task | Priority | Dependencies |
|------|----------|--------------|
| Inspection / compliance workflows | HIGH | Placeholder → partial implementation |
| Growa AI unified platform digest | MEDIUM | Cross-module context builder |
| Zod schemas for watchtower API | MEDIUM | API validation consistency |
| Split watchtower API routes | LOW | `/signals`, `/changes`, `/outlook` |
| KPI lineage UI ("Why am I seeing this?") | LOW | Data lineage metadata |
| Performance caching | LOW | Measure aggregation latency first |

---

## BLOCKED

| Task | Blocker |
|------|---------|
| Alert persistence in production | Migration `00028_operational_alerts` must be applied in Supabase |
| Commodity demand/target KPIs | No demand data source |
| Full inspection workflow | Ministry compliance tables not yet modeled |

---

## DEFERRED

| Task | Reason |
|------|--------|
| PDF report engine | No existing infrastructure |
| Persisted intelligence signals | Calculated approach sufficient for v1 |
| satellite-map.tsx split | Large refactor, out of scope |

---

## Database migrations

| Migration | Purpose | Status |
|-----------|---------|--------|
| `00028_operational_alerts.sql` | Operational alert lifecycle | Created — apply in Supabase environments |

---

## Tests

```bash
npm test        # vitest unit tests
npm run build   # Next.js production build
npm run lint    # ESLint
```
