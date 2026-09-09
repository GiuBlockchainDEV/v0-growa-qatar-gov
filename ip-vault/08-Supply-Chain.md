# Supply Chain & Logistics

← [[07-Compliance-Governance]] | [[00-Index]] | Next: [[09-Data-Model]]

---

## Overview

For organizations responsible for sourcing, procurement, and distribution, the supply overview workspace monitors the flow of goods from origin to destination — closing the loop between field production and market availability.

---

## Strategic Context

Food security depends not only on what a nation grows, but on what it sources, imports, and distributes. Supply analysis complements [[05-Intelligence-Workspaces|production intelligence]] with logistics visibility.

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

See [[09-Data-Model]].

---

## User Experience

- Dedicated route: `/dashboard/supply-overview`
- Tailored for state food operator organization types
- Connects sourcing decisions with production outlook data from field intelligence

---

## Related Notes

- [[05-Intelligence-Workspaces]]
- [[09-Data-Model]]
- [[01-Executive-Summary]]
