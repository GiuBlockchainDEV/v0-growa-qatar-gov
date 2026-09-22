# Target Product Architecture — Growa Qatar

**Version:** 2.0 (Full Restructure)  
**Date:** September 2026

---

## 1. North star

Convert institutional agricultural data into **measurable outcomes** through a single chain:

```text
DATA → OBSERVATIONS → SIGNALS → INTELLIGENCE → DECISIONS → ACTIONS
     → MONITORING → VERIFICATION → INSTITUTIONAL LEARNING
```

---

## 2. Seven product areas

| # | Area | Question | Primary users |
|---|------|----------|---------------|
| 1 | **Watchtower** | What requires national attention? | Ministry leadership, directors |
| 2 | **Operations** | Where are assets and activities? | Regional officers, farm managers |
| 3 | **Intelligence** | Why is something happening? | Analysts, agronomists |
| 4 | **Food Security** | What does agriculture mean for availability? | Hassad, food security directors |
| 5 | **Risk & Response** | What needs intervention? | Operations, compliance, inspectors |
| 6 | **Governance** | Who must act, approve, collaborate? | Ministry admin, inter-agency leads |
| 7 | **AI Operations** | How can AI prepare institutional work? | All authorized roles (scoped) |

---

## 3. Information architecture (sidebar)

```text
WATCHTOWER
  National Watchtower

OPERATIONS
  National Map
  Farms & Sites
  Production
  Monitoring

INTELLIGENCE
  Crop & Production
  Satellite & Harvest
  Weather
  Water
  Energy
  Cross-Domain Analytics

FOOD SECURITY
  Supply Position
  Commodities
  Forecast & Resilience

RISK & RESPONSE
  Signals & Alerts
  Investigations
  Inspections
  Compliance
  Corrective Actions

GOVERNANCE
  Programs & Policy
  Inter-Agency
  Reports
  Evidence

AI OPERATIONS
  AI Mission Control
  Briefings

PLATFORM
  Organizations
  Users & Roles
  Data Sharing
  Data Health
  Settings
```

Sections are **filtered by effective role + scope**, not merely hidden.

---

## 4. Application shell

### Left sidebar
- Section headers (7 areas + Platform)
- Compact nav items with semantic status (live / partial / upcoming)
- Role-specific item ordering and defaults

### Top bar (global only)
- Current organization (+ switcher when multi-org)
- Current scope (region / object when applicable)
- Global search (farms, points, commodities)
- Timeframe selector (propagates to compatible views)
- Active alerts indicator
- Language (EN / AR)
- User menu

### Content area
- Full-height workspace
- Optional context ribbon (farm, signal, investigation active)
- No redundant module chrome

---

## 5. Platform context (URL-addressable)

```ts
interface PlatformContext {
  organizationId?: string
  departmentId?: string
  regionId?: string
  farmId?: string
  productionUnitId?: string
  parcelId?: string
  cropId?: string
  growingCycleId?: string
  commodityId?: string
  signalId?: string
  alertId?: string
  investigationId?: string
  inspectionId?: string
  caseId?: string
  timeframe?: string
  lat?: number
  lng?: number
  zoom?: number
  mapLayer?: string
}
```

Implemented via `PlatformContextProvider` (extends operational context). All cross-module navigation uses `lib/platform/navigation.ts`.

---

## 6. Watchtower (exception-driven)

Visual priority:
1. Abnormalities and critical signals
2. Significant change
3. Risk and forecast
4. Actions and unresolved items
5. Normal metrics (compact)

Sections: system state → domain strip → map + signals → what changed → resource summary → outlook → food security position → AI brief → active actions → data health.

---

## 7. Intelligence workspace pattern

Every intelligence module follows:

```text
CONTEXT HEADER
CURRENT CONDITION
WHAT CHANGED
PRIMARY ANALYSIS
MAP / TIMESERIES
AFFECTED ENTITIES
SIGNALS
FORECAST
AI ANALYSIS
AVAILABLE ACTIONS
```

Shared component: `IntelligenceInvestigationLayout`.

---

## 8. Farm workspace

Route: `/dashboard/farms/[id]`

Tabs: Overview | Production | Satellite | Weather | Water | Energy | Monitoring | Alerts | Inspections | Compliance | Data Quality

Farm is the **primary investigation object** linking all domains.

---

## 9. Food security model

```text
Agricultural capacity → Current production → Crop condition → Expected harvest
→ Domestic supply → External supply → Demand → Coverage → Gap → National risk
```

Commodity workspace: `/dashboard/food-security/commodities/[id]` (partial v1 with honest gaps).

---

## 10. Risk operating model

```text
RAW DATA → OBSERVATION → SIGNAL → RISK → ALERT → INVESTIGATION
→ INSPECTION → ACTION → MONITORING → RESOLUTION
```

Separate entities; signals are computed, alerts persisted, investigations new persisted entity (v1).

---

## 11. Agentic AI architecture

### Specialist agents
Watchtower Analyst, Agronomy Analyst, Water Analyst, Energy Analyst, Food Security Analyst, Supply Analyst, Compliance Analyst, Policy Analyst, Reporting Agent, Data Quality Agent.

### Orchestrator
Receives user mission → plans subtasks → assigns agents → collects artifacts → synthesizes → proposes actions → waits for human approval.

### Execution model
```text
USER REQUEST → ORCHESTRATOR → TASK PLAN → SPECIALIST AGENT(S)
→ PERMISSIONED TOOL CALLS → ANALYSIS → HANDOFF → SYNTHESIS
→ HUMAN REVIEW → OPTIONAL PLATFORM ACTION
```

### Tool layer (server-side, RLS-enforced)
`get_farm`, `get_farms`, `get_weather`, `get_satellite_metrics`, `get_water_metrics`, `get_active_signals`, `get_alerts`, `get_data_quality`, etc.

### Human-in-the-loop
AI prepares and proposes; humans approve: create alert, open investigation, schedule inspection, share data, close case.

### AI Mission Control
`/dashboard?module=ai-mission-control` — active missions, waiting for human, recent outputs, agent health.

### Persistence
- `agent_missions` — task lifecycle
- `agent_mission_events` — activity trace (no chain-of-thought)
- `agent_artifacts` — structured outputs
- `agent_action_proposals` — HITL proposals

---

## 12. Role-specific home experiences

| Role | Landing | Priority |
|------|---------|----------|
| Food Security Director | Watchtower + Supply | Coverage, commodities |
| Regional Operations Officer | Regional map + alerts + farms | Assignments |
| Inspector | Inspection queue | Evidence, cases |
| Agronomist | Crop health + farms + satellite | NDVI, recommendations |
| Compliance Officer | Compliance + cases | Findings, audit |
| Analyst | Cross-domain analytics | Reports |
| Executive (read-only) | Summarized Watchtower | Brief only |
| External operator | Own farms only | Scoped operations |
| Farm manager | Farms + production | Own org only |

---

## 13. Security boundaries

- All reads: user session + RLS
- AI tools: inherit user permissions; no service-role in user-facing paths
- Agent audit: user, org, task type, tools used, timestamps, outputs, approvals
- No hidden chain-of-thought stored

---

## 14. Routing map

| Route | Workspace |
|-------|-----------|
| `/dashboard?module=watchtower` | National Watchtower |
| `/dashboard?module=live-map` | National Map |
| `/dashboard/farms` | Farm registry |
| `/dashboard/farms/[id]` | Unified farm workspace |
| `/dashboard/supply-overview` | Supply Position |
| `/dashboard?module=ai-mission-control` | AI Mission Control |
| `/dashboard?module=investigations` | Investigations (v1) |
| `/dashboard?module=*` | Intelligence / risk modules |

---

## 15. Data flow

```text
Supabase (RLS) ──┬── Operations API ──┬── Watchtower BFF
Harvest API ─────┤                      ├── Intelligence workspaces
Weather API ─────┤                      ├── Farm workspace
RSS ─────────────┘                      └── AI tool layer
                                              ↓
                                         Agent orchestrator
                                              ↓
                                         Mission Control UI
```

---

## 16. Implementation phases (this program)

See `docs/FULL_RESTRUCTURE_IMPLEMENTATION_PLAN.md` for live work log.

Phases 1–4: Audit, shell, navigation, context  
Phases 5–9: Watchtower, map, farm, intelligence, food security  
Phases 10–13: Signals, risk, inspections, governance  
Phases 14–17: Agentic AI, Mission Control, reporting artifacts  
Phases 18–20: Data quality, visual pass, legacy cleanup
