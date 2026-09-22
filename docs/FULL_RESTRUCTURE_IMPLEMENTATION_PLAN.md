# Full Product Restructure — Implementation Plan

---

## DONE

| Phase | Deliverable |
|-------|-------------|
| 1 | `docs/CURRENT_PRODUCT_REALITY.md` — honest product audit |
| 1 | `docs/TARGET_PRODUCT_ARCHITECTURE.md` — target IA + AI model |
| 2 | `lib/platform/product-navigation.ts` — 7-area + platform IA |
| 2 | `components/platform/platform-sidebar.tsx` — new shell sidebar |
| 2 | `components/platform/platform-shell-controls.tsx` — org/scope/timeframe/alerts |
| 2 | `app/dashboard/layout.tsx` — platform shell integration |
| 3 | Role landings via `buildProductNavigation` in role-navigation-context |
| 4 | `lib/domain/platform-context.ts` — extended context types |
| 7 | `app/dashboard/farms/[id]/page.tsx` — unified farm workspace (tabs) |
| 10–11 | `operational_investigations` migration + API + workspace |
| 14–16 | `lib/ai/agents/*` — types, registry, tools, orchestrator |
| 14–16 | `agent_missions` migration + `/api/ai/missions` |
| 16 | `ai-mission-control-workspace.tsx` |
| 18 | `data-health-workspace.tsx` |
| — | Signal → investigation navigation on Watchtower cards |

---

## IN PROGRESS

| Phase | Task |
|-------|------|
| 5 | Watchtower exception-driven visual hierarchy pass |
| 6 | Full map layer registry wiring in SatelliteMap |
| 8 | `IntelligenceInvestigationLayout` shared component |
| 9 | Commodity workspace route |
| — | Commit, push, PR for shell + AI foundations |

---

## NEXT

| Phase | Task |
|-------|------|
| 12 | Inspection workflow v1 |
| 13 | Inter-agency collaboration schema |
| 15 | LLM synthesis in agent missions (grounded) |
| 17 | Report artifacts persistence |
| 19 | Full RTL/i18n pass |
| 20 | Remove legacy sidebar + duplicate analytics route |

---

## Migrations required

- `00028_operational_alerts.sql`
- `00029_agent_missions.sql` (includes `operational_investigations`)

---

## Verify

```bash
npm test && npm run build
```
