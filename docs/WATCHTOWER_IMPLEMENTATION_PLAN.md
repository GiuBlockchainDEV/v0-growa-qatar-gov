# Watchtower Implementation Plan

Live work log for the National Agricultural Watchtower program.

---

## DONE

| Task | Files | Notes |
|------|-------|-------|
| Phase 0: Platform audit | `docs/PLATFORM_INTEGRATION_AUDIT.md` | Module inventory, gaps classified |
| Shared domain types | `lib/domain/types.ts` | Signals, status, metrics, data quality |
| Operational context | `lib/domain/operational-context.ts` | URL-addressable state |
| Timeframe utilities | `lib/domain/timeframes.ts` | NOW/24H/7D/30D/SEASON |
| Cross-module navigation | `lib/dashboard/operational-navigation.ts` | navigateToFarm/Signal/Module |
| Intelligence normalize (server-safe) | `lib/operations/intelligence-normalize.ts` | Extracted from client component |
| Signal rules config | `lib/watchtower/config/signal-rules.ts` | Documented thresholds |
| Signals engine | `lib/watchtower/signals-engine.ts` | Deterministic rule-based signals |
| Changes engine | `lib/watchtower/changes-engine.ts` | What Changed section |
| Source health | `lib/watchtower/source-health.ts` | Per-source status |
| Watchtower aggregation | `lib/watchtower/build-summary.ts` | Full summary builder |
| Watchtower API | `app/api/watchtower/summary/route.ts` | BFF aggregation endpoint |
| Watchtower UI shell | `components/dashboard/watchtower-workspace.tsx` | Full command center UI |
| Watchtower sub-components | `components/dashboard/watchtower/*` | Status, signals, KPIs, outlook |
| Module registry update | `lib/navigation/module-registry.ts` | watchtower module + landing |
| Dashboard routing | `app/dashboard/page.tsx`, `map-navigation.ts` | watchtower + national-overview alias |
| Sidebar sections | `lib/navigation/sections.ts`, `sidebar.tsx` | Ministry IA grouping |
| Metric definitions | `docs/METRIC_DEFINITIONS.md` | KPI methodology |
| Architecture decisions | `docs/ARCHITECTURE_DECISIONS.md` | Key technical choices |
| Unit tests | `lib/**/*.test.ts`, vitest | Signals, timeframes, navigation |
| Phase 7: Map integration | `page.tsx`, `signal-queue.tsx`, `operational-navigation.ts` | Watchtower 75/25 map layout, View on map links |
| Phase 13: AI Watchtower briefing | `lib/ai/build-watchtower-growa-context.ts` | Growa panel in watchtower workspace |
| pnpm lockfile sync | `pnpm-lock.yaml` | Vercel frozen-lockfile CI fix |

---

## IN PROGRESS

| Task | Files | Remaining |
|------|-------|-----------|
| Farm unified intelligence panel | `components/dashboard/farm-intelligence-panel.tsx` | Cross-module farm context |
| Supply ↔ production linkage | supply overview + watchtower | Commodity coverage objects |

---

## NEXT

| Task | Priority | Dependencies |
|------|----------|--------------|
| Farm unified intelligence panel | HIGH | Operations + harvest context |
| Supply ↔ production linkage | HIGH | Commodity objects |
| Alert lifecycle schema | MEDIUM | Migration design |
| Placeholder module cleanup | MEDIUM | Mark upcoming vs hide |
| Growa AI cross-module refactor | MEDIUM | Normalized digest builder |
| Watchtower embedded map panel | MEDIUM | Map layer registry wiring |
| Arabic i18n for watchtower strings | MEDIUM | `lib/i18n/locales/*` |
| Performance caching | LOW | Redis or ISR tuning |

---

## BLOCKED

| Task | Blocker |
|------|---------|
| Formal alert persistence | No alerts table in schema yet |
| Inspection workflow | Ministry modules are placeholders |
| Commodity demand/target KPIs | No demand data source |

---

## DEFERRED

| Task | Reason |
|------|--------|
| PDF report engine | No existing infrastructure |
| Persisted intelligence signals | Calculated approach sufficient for v1 |
| Full 510-cell weather in Watchtower | Performance — sample 5 zones instead |
| satellite-map.tsx split | Large refactor, out of scope |

---

## Database Changes

**None in this phase.** Watchtower metrics are calculated server-side from existing tables and APIs. Future phases may add:
- `intelligence_signals` (optional persistence)
- `alerts` lifecycle table
- `data_source_health` snapshots

---

## API Changes

| Route | Method | Status |
|-------|--------|--------|
| `/api/watchtower/summary` | GET | ✅ Implemented |
| `/api/watchtower/signals` | GET | Deferred (included in summary) |
| `/api/watchtower/changes` | GET | Deferred (included in summary) |
| `/api/watchtower/data-quality` | GET | Deferred (included in summary) |

---

## Tests

```bash
npm test        # vitest run
npm run build   # TypeScript + Next.js build
npm run lint    # ESLint
```

Coverage priority: signal thresholds, navigation URL building, timeframe parsing, status classification.
